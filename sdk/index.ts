import { Dispatcher } from 'undici-types';
import { getEnvironmentFeatureStates, getIdentityFeatureStates } from '../flagsmith-engine/index.js';
import { EnvironmentModel } from '../flagsmith-engine/index.js';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util.js';
import { IdentityModel } from '../flagsmith-engine/index.js';
import { TraitModel } from '../flagsmith-engine/index.js';

import {ANALYTICS_ENDPOINT, AnalyticsProcessor} from './analytics.js';
import { BaseOfflineHandler } from './offline_handlers.js';
import { FlagsmithAPIError, FlagsmithClientError } from './errors.js';

import { DefaultFlag, Flags } from './models.js';
import { EnvironmentDataPollingManager } from './polling_manager.js';
import { generateIdentitiesData, retryFetch } from './utils.js';
import { SegmentModel } from '../flagsmith-engine/index.js';
import { getIdentitySegments } from '../flagsmith-engine/segments/evaluators.js';
import { Fetch, FlagsmithCache, FlagsmithConfig, FlagsmithTraitValue, ITraitConfig } from './types.js';
import { pino, Logger } from 'pino';

export { AnalyticsProcessor, AnalyticsProcessorOptions } from './analytics.js';
export { FlagsmithAPIError, FlagsmithClientError } from './errors.js';

export { DefaultFlag, Flags } from './models.js';
export { EnvironmentDataPollingManager } from './polling_manager.js';
export { FlagsmithCache, FlagsmithConfig } from './types.js';

const DEFAULT_API_URL = 'https://edge.api.flagsmith.com/api/v1/';
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;

export class Flagsmith {
    environmentKey?: string = undefined;
    apiUrl?: string = undefined;
    analyticsUrl?: string = undefined;
    customHeaders?: { [key: string]: any };
    agent?: Dispatcher;
    requestTimeoutMs?: number;
    enableLocalEvaluation?: boolean = false;
    environmentRefreshIntervalSeconds: number = 60;
    retries?: number;
    enableAnalytics: boolean = false;
    defaultFlagHandler?: (featureName: string) => DefaultFlag;

    environmentFlagsUrl?: string;
    identitiesUrl?: string;
    environmentUrl?: string;

    environmentDataPollingManager?: EnvironmentDataPollingManager;
    environment!: EnvironmentModel;
    offlineMode: boolean = false;
    offlineHandler?: BaseOfflineHandler = undefined;

    identitiesWithOverridesByIdentifier?: Map<string, IdentityModel>;

    private cache?: FlagsmithCache;
    private onEnvironmentChange?: (error: Error | null, result: EnvironmentModel) => void;
    private analyticsProcessor?: AnalyticsProcessor;
    private logger: Logger;
    private customFetch: Fetch;
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
     *      Required unless offlineMode is True.
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
            flags cannot be retrieved from the API or a non-existent feature is
            requested
        @param data.logger: an instance of the pino Logger class to use for logging
        @param {boolean} data.offlineMode: sets the client into offline mode. Relies on offlineHandler for
            evaluating flags.
        @param {BaseOfflineHandler} data.offlineHandler: provide a handler for offline logic. Used to get environment
            document from another source when in offlineMode. Works in place of
            defaultFlagHandler if offlineMode is not set and using remote evaluation.
    */
    constructor(data: FlagsmithConfig = {}) {
        // if (!data.offlineMode && !data.environmentKey) {
        //     throw new Error('ValueError: environmentKey is required.');
        // }

        this.agent = data.agent;
        this.customFetch = data.fetch ?? fetch;
        this.environmentKey = data.environmentKey;
        this.apiUrl = data.apiUrl || this.apiUrl;
        this.customHeaders = data.customHeaders;
        this.requestTimeoutMs =
            1000 * (data.requestTimeoutSeconds ?? DEFAULT_REQUEST_TIMEOUT_SECONDS);
        this.enableLocalEvaluation = data.enableLocalEvaluation;
        this.environmentRefreshIntervalSeconds =
            data.environmentRefreshIntervalSeconds || this.environmentRefreshIntervalSeconds;
        this.retries = data.retries;
        this.enableAnalytics = data.enableAnalytics || false;
        this.defaultFlagHandler = data.defaultFlagHandler;

        this.onEnvironmentChange = data.onEnvironmentChange;
        this.logger = data.logger || pino();
        this.offlineMode = data.offlineMode || false;
        this.offlineHandler = data.offlineHandler;

        // argument validation
        if (this.offlineMode && !this.offlineHandler) {
            throw new Error('ValueError: offlineHandler must be provided to use offline mode.');
        } else if (this.defaultFlagHandler && this.offlineHandler) {
            throw new Error('ValueError: Cannot use both defaultFlagHandler and offlineHandler.');
        }

        if (this.offlineHandler) {
            this.environment = this.offlineHandler.getEnvironment();
        }

        if (!!data.cache) {
            this.cache = data.cache;
        }

        if (!this.offlineMode) {
            if (!this.environmentKey) {
                throw new Error('ValueError: environmentKey is required.');
            }

            const apiUrl = data.apiUrl || DEFAULT_API_URL;
            this.apiUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
            this.analyticsUrl = this.analyticsUrl || new URL(ANALYTICS_ENDPOINT, new Request(this.apiUrl).url).href
            this.environmentFlagsUrl = `${this.apiUrl}flags/`;
            this.identitiesUrl = `${this.apiUrl}identities/`;
            this.environmentUrl = `${this.apiUrl}environment-document/`;

            if (this.enableLocalEvaluation) {
                if (!this.environmentKey.startsWith('ser.')) {
                    console.error(
                        'In order to use local evaluation, please generate a server key in the environment settings page.'
                    );
                }
                this.environmentDataPollingManager = new EnvironmentDataPollingManager(
                    this,
                    this.environmentRefreshIntervalSeconds
                );
                this.environmentDataPollingManager.start();
                this.updateEnvironment();
            }

            if (data.enableAnalytics) {
                this.analyticsProcessor = new AnalyticsProcessor({
                    environmentKey: this.environmentKey,
                    analyticsUrl: this.analyticsUrl,
                    requestTimeoutMs: this.requestTimeoutMs,
                    logger: this.logger,
                })
            }
        }
    }
    /**
     * Get all the default for flags for the current environment.
     *
     * @returns Flags object holding all the flags for the current environment.
     */
    async getEnvironmentFlags(): Promise<Flags> {
        const cachedItem = !!this.cache && (await this.cache.get(`flags`));
        if (!!cachedItem) {
            return cachedItem;
        }
        if (this.enableLocalEvaluation && !this.offlineMode) {
            return new Promise((resolve, reject) =>
                this.environmentPromise!.then(() => {
                    resolve(this.getEnvironmentFlagsFromDocument());
                }).catch(e => reject(e))
            );
        }
        if (this.environment) {
            return this.getEnvironmentFlagsFromDocument();
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
     * @param  {{[key:string]:any | ITraitConfig}} traits? a dictionary of traits to add / update on the identity in
            Flagsmith, e.g. {"num_orders": 10} or {age: {value: 30, transient: true}}
     * @returns Flags object holding all the flags for the given identity.
     */
    async getIdentityFlags(
        identifier: string,
        traits?: { [key: string]: FlagsmithTraitValue | ITraitConfig },
        transient: boolean = false
    ): Promise<Flags> {
        if (!identifier) {
            throw new Error('`identifier` argument is missing or invalid.');
        }

        const cachedItem = !!this.cache && (await this.cache.get(`flags-${identifier}`));
        if (!!cachedItem) {
            return cachedItem;
        }
        traits = traits || {};
        if (this.enableLocalEvaluation) {
            return new Promise((resolve, reject) =>
                this.environmentPromise!.then(() => {
                    resolve(this.getIdentityFlagsFromDocument(identifier, traits || {}));
                }).catch(e => reject(e))
            );
        }
        if (this.offlineMode) {
            return this.getIdentityFlagsFromDocument(identifier, traits || {});
        }

        return this.getIdentityFlagsFromApi(identifier, traits, transient);
    }

    /**
     * Get the segments for the current environment for a given identity. Will also
        upsert all traits to the Flagsmith API for future evaluations. Providing a
        trait with a value of None will remove the trait from the identity if it exists.
     *
     * @param  {string} identifier a unique identifier for the identity in the current
            environment, e.g. email address, username, uuid
     * @param  {{[key:string]:any}} traits? a dictionary of traits to add / update on the identity in
            Flagsmith, e.g. {"num_orders": 10}
     * @returns Segments that the given identity belongs to.
     */
    getIdentitySegments(
        identifier: string,
        traits?: { [key: string]: any }
    ): Promise<SegmentModel[]> {
        if (!identifier) {
            throw new Error('`identifier` argument is missing or invalid.');
        }

        traits = traits || {};
        if (this.enableLocalEvaluation) {
            return new Promise((resolve, reject) => {
                return this.environmentPromise!.then(() => {
                    const identityModel = this.getIdentityModel(
                        identifier,
                        Object.keys(traits || {}).map(key => ({
                            key,
                            value: traits?.[key]
                        }))
                    );

                    const segments = getIdentitySegments(this.environment, identityModel);
                    return resolve(segments);
                }).catch(e => reject(e));
            });
        }
        console.error('This function is only permitted with local evaluation.');
        return Promise.resolve([]);
    }

    /**
     * Updates the environment state for local flag evaluation.
     * Sets a local promise to prevent race conditions in getIdentityFlags / getIdentitySegments.
     * You only need to call this if you wish to bypass environmentRefreshIntervalSeconds.
     */
    async updateEnvironment() {
        try {
            const request = this.getEnvironmentFromApi();
            if (!this.environmentPromise) {
                this.environmentPromise = request.then(res => {
                    this.environment = res;
                });
                await this.environmentPromise;
            } else {
                this.environment = await request;
            }
            if (this.environment.identityOverrides?.length) {
                this.identitiesWithOverridesByIdentifier = new Map<string, IdentityModel>(
                    this.environment.identityOverrides.map(identity => [
                        identity.identifier,
                        identity
                    ])
                );
            }
            if (this.onEnvironmentChange) {
                this.onEnvironmentChange(null, this.environment);
            }
        } catch (e) {
            if (this.onEnvironmentChange) {
                this.onEnvironmentChange(e as Error, this.environment);
            }
        }
    }

    async close() {
        this.environmentDataPollingManager?.stop();
    }

    private async getJSONResponse(
        url: string,
        method: string,
        body?: { [key: string]: any }
    ): Promise<any> {
        const headers: { [key: string]: any } = { 'Content-Type': 'application/json' };
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
                dispatcher: this.agent,
                method: method,
                body: JSON.stringify(body),
                headers: headers
            },
            this.retries,
            this.requestTimeoutMs,
            this.customFetch,
        );

        if (data.status !== 200) {
            throw new FlagsmithAPIError(
                `Invalid request made to Flagsmith API. Response status code: ${data.status}`
            );
        }

        return data.json();
    }

    /**
     * This promise ensures that the environment is retrieved before attempting to locally evaluate.
     */
    private environmentPromise: Promise<any> | undefined;

    private async getEnvironmentFromApi() {
        if (!this.environmentUrl) {
            throw new Error('`apiUrl` argument is missing or invalid.');
        }
        const environment_data = await this.getJSONResponse(this.environmentUrl, 'GET');
        return buildEnvironmentModel(environment_data);
    }

    private async getEnvironmentFlagsFromDocument(): Promise<Flags> {
        const flags = Flags.fromFeatureStateModels({
            featureStates: getEnvironmentFeatureStates(this.environment),
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler
        });
        if (!!this.cache) {
            await this.cache.set('flags', flags);
        }
        return flags;
    }

    private async getIdentityFlagsFromDocument(
        identifier: string,
        traits: { [key: string]: any }
    ): Promise<Flags> {
        const identityModel = this.getIdentityModel(
            identifier,
            Object.keys(traits).map(key => ({
                key,
                value: traits[key]
            }))
        );

        const featureStates = getIdentityFeatureStates(this.environment, identityModel);

        const flags = Flags.fromFeatureStateModels({
            featureStates: featureStates,
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler,
            identityID: identityModel.djangoID || identityModel.compositeKey
        });

        if (!!this.cache) {
            await this.cache.set(`flags-${identifier}`, flags);
        }

        return flags;
    }

    private async getEnvironmentFlagsFromApi() {
        if (!this.environmentFlagsUrl) {
            throw new Error('`apiUrl` argument is missing or invalid.');
        }
        try {
            const apiFlags = await this.getJSONResponse(this.environmentFlagsUrl, 'GET');
            const flags = Flags.fromAPIFlags({
                apiFlags: apiFlags,
                analyticsProcessor: this.analyticsProcessor,
                defaultFlagHandler: this.defaultFlagHandler
            });
            if (!!this.cache) {
                await this.cache.set('flags', flags);
            }
            return flags;
        } catch (e) {
            if (this.offlineHandler) {
                return this.getEnvironmentFlagsFromDocument();
            }
            if (this.defaultFlagHandler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.defaultFlagHandler
                });
            }

            throw e;
        }
    }

    private async getIdentityFlagsFromApi(
        identifier: string,
        traits: { [key: string]: FlagsmithTraitValue | ITraitConfig },
        transient: boolean = false
    ) {
        if (!this.identitiesUrl) {
            throw new Error('`apiUrl` argument is missing or invalid.');
        }
        try {
            const data = generateIdentitiesData(identifier, traits, transient);
            const jsonResponse = await this.getJSONResponse(this.identitiesUrl, 'POST', data);
            const flags = Flags.fromAPIFlags({
                apiFlags: jsonResponse['flags'],
                analyticsProcessor: this.analyticsProcessor,
                defaultFlagHandler: this.defaultFlagHandler
            });
            if (!!this.cache) {
                await this.cache.set(`flags-${identifier}`, flags);
            }
            return flags;
        } catch (e) {
            if (this.offlineHandler) {
                return this.getIdentityFlagsFromDocument(identifier, traits);
            }
            if (this.defaultFlagHandler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.defaultFlagHandler
                });
            }

            throw e;
        }
    }

    private getIdentityModel(identifier: string, traits: { key: string; value: any }[]) {
        const traitModels = traits.map(trait => new TraitModel(trait.key, trait.value));
        let identityWithOverrides = this.identitiesWithOverridesByIdentifier?.get(identifier);
        if (identityWithOverrides) {
            identityWithOverrides.updateTraits(traitModels);
            return identityWithOverrides;
        }
        return new IdentityModel('0', traitModels, [], this.environment.apiKey, identifier);
    }
}

export default Flagsmith;
