import fetch from 'node-fetch';
import { getEnvironmentFeatureStates, getIdentityFeatureStates } from '../flagsmith-engine';
import { EnvironmentModel } from '../flagsmith-engine/environments/models';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util';
import { IdentityModel } from '../flagsmith-engine/identities/models';
import { TraitModel } from '../flagsmith-engine/identities/traits/models';

import { AnalyticsProcessor } from './analytics';
import { FlagsmithAPIError, FlagsmithClientError } from './errors';

import { DefaultFlag, Flags } from './models';
import { EnvironmentDataPollingManager } from './polling_manager';
import { generateIdentitiesData } from './utils';

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
    environment?: EnvironmentModel;
    private analyticsProcessor?: AnalyticsProcessor;

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

        this.environment;
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

    async getEnvironmentFlags(): Promise<Flags> {
        if (this.environment) {
            return new Promise(resolve => resolve(this.getEnvironmentFlagsFromDocument()));
        }

        return this.getEnvironmentFlagsFromApi();
    }

    getIdentityFlags(identifier: string, traits?: { [key: string]: any }): Promise<Flags> {
        traits = traits || {};
        if (this.environment) {
            return new Promise(resolve =>
                resolve(this.getIdentityFlagsFromDocument(identifier, traits || {}))
            );
        }
        return this.getIdentityFlagsFromApi(identifier, traits);
    }

    async update_environment() {
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

        const data = await fetch(url, {
            method: method,
            timeout: this.requestTimeoutSeconds || undefined,
            body: JSON.stringify(body),
            headers: headers
        });

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
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        return Flags.fromFeatureStateModels({
            featureStates: getEnvironmentFeatureStates(this.environment),
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler
        });
    }

    private getIdentityFlagsFromDocument(identifier: string, traits: { [key: string]: any }) {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        const identityModel = this.buildIdentityModel(identifier, Object.values(traits));
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

    private buildIdentityModel(identifier: string, traits: any[]) {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        const traitModels = traits.map(trait => new TraitModel(trait.key, trait.value));
        return new IdentityModel('0', traitModels, [], this.environment.apiKey, identifier);
    }

    stop() {}
}

export default Flagsmith;
