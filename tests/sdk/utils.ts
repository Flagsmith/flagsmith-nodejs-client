import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util.js';
import { AnalyticsProcessor } from '../../sdk/analytics.js';
import Flagsmith, { FlagsmithConfig } from '../../sdk/index.js';
import { Fetch, FlagsmithCache } from '../../sdk/types.js';
import { Flags } from '../../sdk/models.js';
import { fetch } from './fetchMock.js';

const DATA_DIR = __dirname + '/data/';

export class TestCache implements FlagsmithCache {
    cache: Record<string, Flags> = {};

    async get(name: string): Promise<Flags | undefined> {
        return this.cache[name];
    }

    async set(name: string, value: Flags) {
        this.cache[name] = value;
    }
}

export const badFetch: Fetch = () => {
    throw new Error('fetch failed');
};

export function analyticsProcessor() {
    return new AnalyticsProcessor({
        environmentKey: 'test-key',
        analyticsUrl: 'http://testUrl/analytics/flags/',
        fetch: (url, options) => fetch(url.toString(), options)
    });
}

export function apiKey(): string {
    return 'sometestfakekey';
}

export function flagsmith(params: FlagsmithConfig = {}) {
    return new Flagsmith({
        environmentKey: apiKey(),
        environmentRefreshIntervalSeconds: 0,
        requestRetryDelayMilliseconds: 0,
        fetch: (url, options) => fetch(url.toString(), options),
        ...params
    });
}

export const offlineEnvironmentJSON = readFileSync(DATA_DIR + 'offline-environment.json', 'utf-8');

export function environmentModel(environmentJSON: any) {
    return buildEnvironmentModel(environmentJSON);
}

export const transientIdentityJSON = readFileSync(DATA_DIR + 'transient-identity.json', 'utf-8');

export const identityWithTransientTraitsJSON = readFileSync(
    DATA_DIR + 'identity-with-transient-traits.json',
    'utf-8'
);
