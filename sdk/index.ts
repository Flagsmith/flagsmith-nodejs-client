import { getEnvironmentFeatureStates, getIdentityFeatureStates } from '../flagsmith-engine';
import { EnvironmentModel } from '../flagsmith-engine/environments/models';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util';
import { IdentityModel } from '../flagsmith-engine/identities/models';
import { TraitModel } from '../flagsmith-engine/identities/traits/models';

import { AnalyticsProcessor } from './analytics';
import { FlagsmithAPIError, FlagsmithClientError } from './errors';

import { DefaultFlag, Flags } from './models';
import { EnvironmentDataPollingManager } from './polling_manager';
import { generateIdentitiesData, retryFetch } from './utils';

const DEFAULT_API_URL = 'https://api.flagsmith.com/api/v1/';

export class Flagsmith {
    environmentKey?: string;
    apiUrl: string = DEFAULT_API_URL;
    customHeaders?: { [key: string]: any };
    requestTimeoutSeconds?: number;
    enableLocalEvaluation?: boolean = false;
    environmentRefreshIntervalSeconds: number = 60;
    retries?: any;
    enableAnalytics: boolean = false;
    defaultFlagHandler?: (featureName: string) => DefaultFlag;

    environmentFlagsUrl: string;
    identitiesUrl: string;
    environmentUrl: string;

    environmentDataPollingManager?: EnvironmentDataPollingManager;
    environment!: EnvironmentModel;
    private analyticsProcessor?: AnalyticsProcessor;
    /**
     * A Flagsmith client.
     *
     * Provides an interface for interacting with the Flagsmith http API.
     * Basic Usage::
     *
     * import flagsmith from Flagsmith
     * const flagsmith = new Flagsmith({environmentKey: '<your API key>'});
     * const environmentFlags = flagsmith.getEnvironmentFlags();
     * const featureEnabled = environmentFlags.isFeatureEnabled('foo');
     * const identityFlags = flagsmith.getIdentityFlags('identifier', {'foo': 'bar'});
     * const featureEnabledForIdentity = identityFlags.isFeatureEnabled("foo")
     *
     *  @param {string} data.environmentKey: The environment key obtained from Flagsmith interface
        @param {string} data.apiUrl: Override the URL of the Flagsmith API to communicate with
        @param  data.customHeaders: Additional headers to add to requests made to the
            Flagsmith API
        @param {number} data.requestTimeoutSeconds: Number of seconds to wait for a request to
            complete before terminating the request
        @param {boolean} data.enableLocalEvaluation: Enables local evaluation of flags
        @param {number} data.environmentRefreshIntervalSeconds: If using local evaluation,
            specify the interval period between refreshes of local environment data
        @param {number} data.retries: a urllib3.Retry object to use on all http requests to the
            Flagsmith API
        @param {boolean} data.enableAnalytics: if enabled, sends additional requests to the Flagsmith
            API to power flag analytics charts
        @param data.defaultFlagHandler: callable which will be used in the case where
            flags cannot be retrieved from the API or a non existent feature is
            requested
     */
    constructor(data: {
        environmentKey: string;
        apiUrl?: string;
        customHeaders?: { [key: string]: any };
        requestTimeoutSeconds?: number;
        enableLocalEvaluation?: boolean;
        environmentRefreshIntervalSeconds?: number;
        retries?: any;
        enableAnalytics?: boolean;
        defaultFlagHandler?: (featureName: string) => DefaultFlag;
    }) {
        this.environmentKey = data.environmentKey;
        this.apiUrl = data.apiUrl || this.apiUrl;
        this.customHeaders = data.customHeaders;
        this.requestTimeoutSeconds = data.requestTimeoutSeconds;
        this.enableLocalEvaluation = data.enableLocalEvaluation;
        this.environmentRefreshIntervalSeconds =
            data.environmentRefreshIntervalSeconds || this.environmentRefreshIntervalSeconds;
        this.retries = data.retries;
        this.enableAnalytics = data.enableAnalytics || false;
        this.defaultFlagHandler = data.defaultFlagHandler;

        this.environmentFlagsUrl = `${this.apiUrl}flags/`;
        this.identitiesUrl = `${this.apiUrl}identities/`;
        this.environmentUrl = `${this.apiUrl}environment-document/`;

        if (this.enableLocalEvaluation) {
            this.environmentDataPollingManager = new EnvironmentDataPollingManager(
                this,
                this.environmentRefreshIntervalSeconds
            );
            this.environmentDataPollingManager.start();
        }

        this.analyticsProcessor = data.enableAnalytics
            ? new AnalyticsProcessor({
                  environmentKey: this.environmentKey,
                  baseApiUrl: this.apiUrl,
                  timeout: this.requestTimeoutSeconds
              })
            : undefined;
    }
    /**
     * Get all the default for flags for the current environment.
     *
     * @returns Flags object holding all the flags for the current environment.
     */
    async getEnvironmentFlags(): Promise<Flags> {
        if (this.environment) {
            return new Promise(resolve => resolve(this.getEnvironmentFlagsFromDocument()));
        }

        return this.getEnvironmentFlagsFromApi();
    }
    /**
     * Get all the flags for the current environment for a given identity. Will also
        upsert all traits to the Flagsmith API for future evaluations. Providing a
        trait with a value of None will remove the trait from the identity if it exists.
     *
     * @param  {string} identifier a unique identifier for the identity in the current
            environment, e.g. email address, username, uuid
     * @param  {{[key:string]:any}} traits? a dictionary of traits to add / update on the identity in
            Flagsmith, e.g. {"num_orders": 10}
     * @returns Flags object holding all the flags for the given identity.
     */
    getIdentityFlags(identifier: string, traits?: { [key: string]: any }): Promise<Flags> {
        traits = traits || {};
        if (this.environment) {
            return new Promise(resolve =>
                resolve(this.getIdentityFlagsFromDocument(identifier, traits || {}))
            );
        }
        return this.getIdentityFlagsFromApi(identifier, traits);
    }

    /**
     * Updates the environment state for local flag evaluation.
     * You only need to call this if you wish to bypass environmentRefreshIntervalSeconds.
     */
    async updateEnvironment() {
        this.environment = await this.getEnvironmentFromApi();
    }

    private async getJSONResponse(
        url: string,
        method: string,
        body?: { [key: string]: any }
    ): Promise<any> {
        const headers: { [key: string]: any } = {};
        if (this.environmentKey) {
            headers['X-Environment-Key'] = this.environmentKey as string;
        }

        if (this.customHeaders) {
            for (const [k, v] of Object.entries(this.customHeaders)) {
                headers[k] = v;
            }
        }

        const data = await retryFetch(
            url,
            {
                method: method,
                timeout: this.requestTimeoutSeconds || undefined,
                body: JSON.stringify(body),
                headers: headers
            },
            this.retries,
            1000,
            (this.requestTimeoutSeconds || 10) * 1000
        );

        if (data.status !== 200) {
            throw new FlagsmithAPIError(
                `Invalid request made to Flagsmith API. Response status code: ${data.status}`
            );
        }

        return data.json();
    }

    private async getEnvironmentFromApi() {
        const environment_data = await this.getJSONResponse(this.environmentUrl, 'GET');
        return buildEnvironmentModel(environment_data);
    }

    private getEnvironmentFlagsFromDocument() {
        return Flags.fromFeatureStateModels({
            featureStates: getEnvironmentFeatureStates(this.environment),
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler
        });
    }

    private getIdentityFlagsFromDocument(identifier: string, traits: { [key: string]: any }) {
        const identityModel = this.buildIdentityModel(
            identifier,
            Object.keys(traits).map(key => ({
                key,
                value: traits[key]
            }))
        );

        const featureStates = getIdentityFeatureStates(this.environment, identityModel);

        return Flags.fromFeatureStateModels({
            featureStates: featureStates,
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler
        });
    }

    private async getEnvironmentFlagsFromApi() {
        try {
            const apiFlags = await this.getJSONResponse(this.environmentFlagsUrl, 'GET');
            return Flags.fromAPIFlags({
                apiFlags: apiFlags,
                analyticsProcessor: this.analyticsProcessor,
                defaultFlagHandler: this.defaultFlagHandler
            });
        } catch (e) {
            if (this.defaultFlagHandler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.defaultFlagHandler
                });
            }

            throw e;
        }
    }

    private async getIdentityFlagsFromApi(identifier: string, traits: { [key: string]: any }) {
        try {
            const data = generateIdentitiesData(identifier, traits);
            const jsonResponse = await this.getJSONResponse(this.identitiesUrl, 'POST', data);
            return Flags.fromAPIFlags({
                apiFlags: jsonResponse['flags'],
                analyticsProcessor: this.analyticsProcessor,
                defaultFlagHandler: this.defaultFlagHandler
            });
        } catch (e) {
            if (this.defaultFlagHandler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.defaultFlagHandler
                });
            }

            throw e;
        }
    }

    private buildIdentityModel(identifier: string, traits: { key: string; value: any }[]) {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        const traitModels = traits.map(trait => new TraitModel(trait.key, trait.value));
        return new IdentityModel('0', traitModels, [], this.environment.apiKey, identifier);
    }
}

export default Flagsmith;
