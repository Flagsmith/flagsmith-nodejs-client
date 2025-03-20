import { Dispatcher } from 'undici-types';
import { FeatureStateModel, getEnvironmentFeatureStates, getIdentityFeatureStates } from '../flagsmith-engine/index.js';
import { EnvironmentModel } from '../flagsmith-engine/index.js';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util.js';
import { IdentityModel } from '../flagsmith-engine/index.js';
import { TraitModel } from '../flagsmith-engine/index.js';

import {ANALYTICS_ENDPOINT, AnalyticsProcessor} from './analytics.js';
import { BaseOfflineHandler } from './offline_handlers.js';
import { FlagsmithAPIError, FlagsmithClientError } from './errors.js';

import { DefaultFlag, Flags } from './models.js';
import { EnvironmentDataPollingManager } from './polling_manager.js';
import { Deferred, generateIdentitiesData, retryFetch } from './utils.js';
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

/**
 * A client for evaluating Flagsmith feature flags.
 *
 * Flags are evaluated remotely by the Flagsmith API over HTTP by default.
 * To evaluate flags locally, create the client using {@link enableLocalEvaluation} and a server-side SDK key.
 *
 * @example
 * import { Flagsmith, Flags, DefaultFlag } from 'flagsmith-nodejs'
 *
 * const flagsmith = new Flagsmith({
 *   environmentKey: 'your_sdk_key',
 *   defaultFlagHandler: (flagKey: string) => { new DefaultFlag(...) },
 * });
 *
 * // Fetch the current environment flags
 * const environmentFlags: Flags = flagsmith.getEnvironmentFlags()
 * const isFooEnabled: boolean = environmentFlags.isFeatureEnabled('foo')
 *
 * // Evaluate flags for any identity
 * const identityFlags: Flags = flagsmith.getIdentityFlags('my_user_123', {'vip': true})
 * const bannerVariation = identityFlags.getFeatureValue('banner_flag')
 *
 * @see FlagsmithConfig
*/
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
    private environment?: EnvironmentModel;
    offlineMode: boolean = false;
    offlineHandler?: BaseOfflineHandler = undefined;

    identitiesWithOverridesByIdentifier?: Map<string, IdentityModel>;

    private cache?: FlagsmithCache;
    private onEnvironmentChange: (error: Error | null, result?: EnvironmentModel) => void;
    private analyticsProcessor?: AnalyticsProcessor;
    private logger: Logger;
    private customFetch: Fetch;
    private readonly requestRetryDelayMilliseconds: number;

    /**
     * Creates a new {@link Flagsmith} client.
     *
     * If using local evaluation, the environment will be fetched lazily when needed by any method. Polling the
     * environment for updates will start after {@link environmentRefreshIntervalSeconds} once the client is created.
     * @param data The {@link FlagsmithConfig} options for this client.
     */
    constructor(data: FlagsmithConfig) {
        this.agent = data.agent;
        this.customFetch = data.fetch ?? fetch;
        this.environmentKey = data.environmentKey;
        this.apiUrl = data.apiUrl || DEFAULT_API_URL;
        this.customHeaders = data.customHeaders;
        this.requestTimeoutMs =
            1000 * (data.requestTimeoutSeconds ?? DEFAULT_REQUEST_TIMEOUT_SECONDS);
        this.requestRetryDelayMilliseconds = data.requestRetryDelayMilliseconds ?? 1000;
        this.enableLocalEvaluation = data.enableLocalEvaluation;
        this.environmentRefreshIntervalSeconds =
            data.environmentRefreshIntervalSeconds || this.environmentRefreshIntervalSeconds;
        this.retries = data.retries;
        this.enableAnalytics = data.enableAnalytics || false;
        this.defaultFlagHandler = data.defaultFlagHandler;

        this.onEnvironmentChange = (error, result) => data.onEnvironmentChange?.(error, result);
        this.logger = data.logger || pino();
        this.offlineMode = data.offlineMode || false;
        this.offlineHandler = data.offlineHandler;

        // argument validation
        if (this.offlineMode && !this.offlineHandler) {
            throw new Error('ValueError: offlineHandler must be provided to use offline mode.');
        } else if (this.defaultFlagHandler && this.offlineHandler) {
            throw new Error('ValueError: Cannot use both defaultFlagHandler and offlineHandler.');
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
                    throw new Error('Using local evaluation requires a server-side environment key');
                }
                if (this.environmentRefreshIntervalSeconds > 0){
                    this.environmentDataPollingManager = new EnvironmentDataPollingManager(
                        this,
                        this.environmentRefreshIntervalSeconds,
                        this.logger,
                    );
                    this.environmentDataPollingManager.start();
                }
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
        try {
            if (this.enableLocalEvaluation || this.offlineMode) {
                const environment = await this.getEnvironment();
                return this.getEnvironmentFlagsFromDocument(environment);
            }
            return this.getEnvironmentFlagsFromApi();
        } catch (error) {
            this.logger.error(error, 'getEnvironmentFlags failed');
            return new Flags({
                flags: {},
                defaultFlagHandler: this.defaultFlagHandler
            });
        }
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
        try {
            if (this.enableLocalEvaluation || this.offlineMode) {
                const environment = await this.getEnvironment();
                return this.getIdentityFlagsFromDocument(environment, identifier, traits || {});
            }
            return await this.getIdentityFlagsFromApi(identifier, traits, transient);
        } catch (error) {
            if (!this.defaultFlagHandler) {
                throw new Error('getIdentityFlags failed and no default flag handler was provided')
            }
            this.logger.error(error, 'getIdentityFlags failed');
            return new Flags({
                flags: {},
                defaultFlagHandler: this.defaultFlagHandler
            });
        }
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
    async getIdentitySegments(
        identifier: string,
        traits?: { [key: string]: any }
    ): Promise<SegmentModel[]> {
        if (!identifier) {
            throw new Error('`identifier` argument is missing or invalid.');
        }
        if (!this.enableLocalEvaluation) {
            this.logger.error('This function is only permitted with local evaluation.');
            return Promise.resolve([]);
        }

        traits = traits || {};
        const environment = await this.getEnvironment();
        const identityModel = this.getIdentityModel(
            environment,
            identifier,
            Object.keys(traits || {}).map(key => ({
                key,
                value: traits?.[key]
            }))
        );

        return getIdentitySegments(environment, identityModel);
    }

    private async fetchEnvironment(): Promise<EnvironmentModel> {
        const deferred = new Deferred<EnvironmentModel>();
        this.environmentPromise = deferred.promise;
        try {
            const environment = await this.getEnvironmentFromApi();
            this.environment = environment;
            if (environment.identityOverrides?.length) {
                this.identitiesWithOverridesByIdentifier = new Map<string, IdentityModel>(
                    environment.identityOverrides.map(identity => [identity.identifier, identity])
                );
            }
            deferred.resolve(environment);
            return deferred.promise;
        } catch (error) {
            deferred.reject(error);
            return deferred.promise;
        } finally {
            this.environmentPromise = undefined;
        }
    }

    /**
     * Fetch the latest environment state from the Flagsmith API to use for local flag evaluation.
     *
     * If the environment is currently being fetched, calling this method will not cause additional fetches.
     */
    async updateEnvironment(): Promise<void> {
        try {
            if (this.environmentPromise) {
                await this.environmentPromise
                return
            }
            const environment = await this.fetchEnvironment();
            this.onEnvironmentChange(null, environment);
        } catch (e) {
            this.logger.error(e, 'updateEnvironment failed');
            this.onEnvironmentChange(e as Error);
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
            this.requestRetryDelayMilliseconds,
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
    private environmentPromise?: Promise<EnvironmentModel>;

    /**
     * Returns the current environment, fetching it from the API if needed.
     *
     * Calling this method concurrently while the environment is being fetched will not cause additional requests.
     */
    async getEnvironment(): Promise<EnvironmentModel> {
        if (this.offlineHandler) {
            return this.offlineHandler.getEnvironment();
        }
        if (this.environment) {
            return this.environment;
        }
        if (!this.environmentPromise) {
            this.environmentPromise = this.fetchEnvironment();
        }
        return this.environmentPromise;
    }

    private async getEnvironmentFromApi() {
        if (!this.environmentUrl) {
            throw new Error('`apiUrl` argument is missing or invalid.');
        }
        const environment_data = await this.getJSONResponse(this.environmentUrl, 'GET');
        return buildEnvironmentModel(environment_data);
    }

    private async getEnvironmentFlagsFromDocument(environment: EnvironmentModel): Promise<Flags> {
        const flags = Flags.fromFeatureStateModels({
            featureStates: getEnvironmentFeatureStates(environment),
            analyticsProcessor: this.analyticsProcessor,
            defaultFlagHandler: this.defaultFlagHandler
        });
        if (!!this.cache) {
            await this.cache.set('flags', flags);
        }
        return flags;
    }

    private async getIdentityFlagsFromDocument(
        environment: EnvironmentModel,
        identifier: string,
        traits: { [key: string]: any }
    ): Promise<Flags> {
        const identityModel = this.getIdentityModel(
            environment,
            identifier,
            Object.keys(traits).map(key => ({
                key,
                value: traits[key]
            }))
        );

        const featureStates = getIdentityFeatureStates(environment, identityModel);

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
                const environment = this.offlineHandler.getEnvironment();
                return this.getEnvironmentFlagsFromDocument(environment);
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
    }

    private getIdentityModel(
        environment: EnvironmentModel,
        identifier: string,
        traits: { key: string; value: any }[]
    ) {
        const traitModels = traits.map(trait => new TraitModel(trait.key, trait.value));
        let identityWithOverrides =
            this.identitiesWithOverridesByIdentifier?.get(identifier);
        if (identityWithOverrides) {
            identityWithOverrides.updateTraits(traitModels);
            return identityWithOverrides;
        }
        return new IdentityModel('0', traitModels, [], environment.apiKey, identifier);
    }
}

export default Flagsmith;
