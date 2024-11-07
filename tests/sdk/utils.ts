import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util.js';
import { AnalyticsProcessor } from '../../sdk/analytics.js';
import Flagsmith from '../../sdk/index.js';
import { FlagsmithCache } from '../../sdk/types.js';
import { Flags } from '../../sdk/models.js';

const DATA_DIR = __dirname + '/data/';

export class TestCache implements FlagsmithCache {
    cache: Record<string, Flags> = {};

    async get(name: string): Promise<Flags> {
        return this.cache[name];
    }

    async has(name: string): Promise<boolean> {
        return !!this.cache[name];
    }

    async set(name: string, value: Flags) {
        this.cache[name] = value;
    }
}

export const fetch = vi.fn(global.fetch)

export function analyticsProcessor() {
    return new AnalyticsProcessor({
        environmentKey: 'test-key',
        baseApiUrl: 'http://testUrl',
        fetch,
    });
}

export function apiKey(): string {
    return 'sometestfakekey';
}

export function flagsmith(params = {}) {
    return new Flagsmith({
        environmentKey: apiKey(),
        fetch,
        ...params,
    });
}

export const environmentJSON = readFileSync(DATA_DIR + 'environment.json', 'utf-8');

export const offlineEnvironmentJSON = readFileSync(DATA_DIR + 'offline-environment.json', 'utf-8')

export function environmentModel(environmentJSON: any) {
    return buildEnvironmentModel(environmentJSON);
}

export const flagsJSON = readFileSync(DATA_DIR + 'flags.json', 'utf-8')

export const identitiesJSON = readFileSync(DATA_DIR + 'identities.json', 'utf-8')

export const transientIdentityJSON = readFileSync(DATA_DIR + 'transient-identity.json', 'utf-8')

export const identityWithTransientTraitsJSON = readFileSync(DATA_DIR + 'identity-with-transient-traits.json', 'utf-8')
