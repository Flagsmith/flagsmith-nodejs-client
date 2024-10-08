import { DefaultFlag, Flags } from './models.js';
import { EnvironmentModel } from '../flagsmith-engine/index.js';
import { Dispatcher } from 'undici-types';
import { Logger } from 'pino';
import { BaseOfflineHandler } from './offline_handlers.js';

export type IFlagsmithValue<T = string | number | boolean | null> = T;
export interface FlagsmithCache {
    get(key: string): Promise<Flags | undefined> | undefined;
    set(key: string, value: Flags, ttl?: string | number): boolean | Promise<boolean>;
    has(key: string): boolean | Promise<boolean>;
    [key: string]: any;
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
