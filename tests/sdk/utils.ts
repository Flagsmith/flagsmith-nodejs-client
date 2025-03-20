import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util.js';
import { AnalyticsProcessor } from '../../sdk/analytics.js';
import Flagsmith, {FlagsmithConfig} from '../../sdk/index.js';
import { Fetch, FlagsmithCache } from '../../sdk/types.js';
import { Flags } from '../../sdk/models.js';

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

export const fetch = vi.fn((_, options) => {
    const headers = options?.headers as Record<string, string>;
    if (!headers) throw new Error('missing request headers')
    const env = headers['X-Environment-Key'];
    if (!env) return Promise.resolve(new Response("missing x-environment-key header", { status: 404 }))
    if (env.startsWith('ser.')) {
        return Promise.resolve(new Response(environmentJSON, { status: 200 }))
    }
    return Promise.resolve(new Response(identitiesJSON, { status: 200 }))
});

export const badFetch: Fetch = () => { throw new Error('fetch failed')}

export function analyticsProcessor() {
    return new AnalyticsProcessor({
        environmentKey: 'test-key',
        analyticsUrl: 'http://testUrl/analytics/flags/',
        fetch,
    });
}

export function apiKey(): string {
    return 'sometestfakekey';
}

export function flagsmith(params: FlagsmithConfig = {}) {
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
