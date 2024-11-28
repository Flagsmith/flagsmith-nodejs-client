import { DefaultFlag, Flags } from './models.js';
import { EnvironmentModel } from '../flagsmith-engine/index.js';
import { Dispatcher } from 'undici-types';
import { Logger } from 'pino';
import { BaseOfflineHandler } from './offline_handlers.js';

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

export interface FlagsmithConfig {
    environmentKey?: string;
    apiUrl?: string;
    agent?: Dispatcher;
    fetch?: Fetch;
    customHeaders?: { [key: string]: any };
    requestTimeoutSeconds?: number;
    enableLocalEvaluation?: boolean;
    environmentRefreshIntervalSeconds?: number;
    retries?: number;
    enableAnalytics?: boolean;
    defaultFlagHandler?: (featureName: string) => DefaultFlag;
    cache?: FlagsmithCache;
    onEnvironmentChange?: (error: Error | null, result: EnvironmentModel) => void;
    logger?: Logger;
    offlineMode?: boolean;
    offlineHandler?: BaseOfflineHandler;
}

export interface ITraitConfig {
    value: FlagsmithTraitValue;
    transient?: boolean;
}

export declare type FlagsmithTraitValue = IFlagsmithValue;
