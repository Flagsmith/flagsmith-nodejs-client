import { DefaultFlag, Flags } from './models.js';
import { EnvironmentModel } from '../flagsmith-engine/index.js';
import { Dispatcher } from 'undici-types';
import { Logger } from 'pino';
import { BaseOfflineHandler } from './offline_handlers.js';
import { Flagsmith } from './index.js'

export type IFlagsmithValue<T = string | number | boolean | null> = T;


/**
 * Stores and retrieves {@link Flags} from a cache.
 */
export interface FlagsmithCache {
    /**
     * Retrieve the cached {@link Flags} for the given environment or identity, or `undefined` if no cached value exists.
     * @param key An environment ID or identity identifier, which is used as the cache key.
     */
    get(key: string): Promise<Flags | undefined>;

    /**
     * Persist an environment or identity's {@link Flags} in the cache.
     * @param key An environment ID or identity identifier, which is used as the cache key.
     * @param value The {@link Flags} to be stored in the cache.
     */
    set(key: string, value: Flags): Promise<void>;
}

export type Fetch = typeof fetch

/**
 * The configuration options for a {@link Flagsmith} client.
 */
export interface FlagsmithConfig {
    /**
     * The environment's client-side or server-side key.
     */
    environmentKey?: string;
    /**
     * The Flagsmith API URL. Set this if you are not using Flagsmith's public service, i.e. https://app.flagsmith.com.
     *
     * @default https://edge.api.flagsmith.com/api/v1/
     */
    apiUrl?: string;
    /**
     * A custom {@link Dispatcher} to use when making HTTP requests.
     */
    agent?: Dispatcher;
    /**
     * A custom {@link fetch} implementation to use when making HTTP requests.
     */
    fetch?: Fetch;
    /**
     * Custom headers to use in all HTTP requests.
     */
    customHeaders?: HeadersInit
    /**
     * The network request timeout duration, in seconds.
     *
     * @default 10
     */
    requestTimeoutSeconds?: number;
    /**
     * The amount of time, in milliseconds, to wait before retrying failed network requests.
     */
    requestRetryDelayMilliseconds?: number;
    /**
     * If enabled, flags are evaluated locally using the environment state cached in memory.
     *
     * The client will lazily fetch the environment from the Flagsmith API, and poll it every {@link environmentRefreshIntervalSeconds}.
     */
    enableLocalEvaluation?: boolean;
    /**
     * The time, in seconds, to wait before refreshing the cached environment state.
     * @default 60
     */
    environmentRefreshIntervalSeconds?: number;
    /**
     * How many times to retry any failed network request before giving up.
     * @default 3
     */
    retries?: number;
    /**
     * If enabled, the client will keep track of any flags evaluated using {@link Flags.isFeatureEnabled},
     * {@link Flags.getFeatureValue} or {@link Flags.getFlag}, and periodically flush this data to the Flagsmith API.
     */
    enableAnalytics?: boolean;
    /**
     * Used to return fallback values for flags when evaluation fails for any reason. If not provided and flag
     * evaluation fails, an error will be thrown intsead.
     *
     * @param flagKey The key of the flag that failed to evaluate.
     *
     * @example
     * // All flags disabled and with no value by default
     * const defaultHandler = () => new DefaultFlag(undefined, false)
     *
     * // Enable only VIP flags by default
     * const vipDefaultHandler = (key: string) => new Default(undefined, key.startsWith('vip_'))
     */
    defaultFlagHandler?: (flagKey: string) => DefaultFlag;
    cache?: FlagsmithCache;
    /**
     * A callback function to invoke whenever the cached environment is updated.
     * @param error The error that occurred when the environment state failed to update, if any.
     * @param result The updated environment state, if no error was thrown.
     */
    onEnvironmentChange?: (error: Error | null, result?: EnvironmentModel) => void;
    logger?: Logger;
    /**
     * If enabled, the client will work offline and not make any network requests. Requires {@link offlineHandler}.
     */
    offlineMode?: boolean;
    /**
     * If {@link offlineMode} is enabled, this handler is used to calculate the values of all flags.
     */
    offlineHandler?: BaseOfflineHandler;
}

export interface ITraitConfig {
    value: FlagsmithTraitValue;
    transient?: boolean;
}

export declare type FlagsmithTraitValue = IFlagsmithValue;
