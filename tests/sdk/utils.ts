import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util';
import { AnalyticsProcessor } from '../../sdk/analytics';
import Flagsmith from '../../sdk';
import { FlagsmithCache } from '../../sdk/types';
import { Flag, Flags } from '../../sdk/models';

const DATA_DIR = __dirname + '/data/';

export class TestCache implements FlagsmithCache {
    cache: Record<string, Flags> = {};

    async get(name: string): Promise<Flags> {
        return this.cache[name];
    }

    async has(name: string): Promise<boolean> {
        return !!this.cache[name];
    }

    async set(name: string, value: Flags, ttl: number|string) {
        this.cache[name] = value;
        return true
    }
}

export function analyticsProcessor() {
    return new AnalyticsProcessor({
        environmentKey: 'test-key',
        baseApiUrl: 'http://testUrl'
    });
}

export function apiKey(): string {
    return 'sometestfakekey';
}

export function flagsmith(params = {}) {
    return new Flagsmith({
        environmentKey: apiKey(),
        ...params,
    });
}

export function environmentJSON(environmentFilename: string = 'environment.json') {
    return readFileSync(DATA_DIR + environmentFilename, 'utf-8');
}

export function environmentModel(environmentJSON: any) {
    return buildEnvironmentModel(environmentJSON);
}

export function flagsJSON() {
    return readFileSync(DATA_DIR + 'flags.json', 'utf-8');
}

export function identitiesJSON() {
    return readFileSync(DATA_DIR + 'identities.json', 'utf-8');
}

export function traitIdentityJSON() {
    return readFileSync(DATA_DIR + 'transient-identity.json', 'utf-8');
}

export function identityWithTransientTraitsJSON() {
    return readFileSync(DATA_DIR + 'identity-with-transient-traits.json', 'utf-8');
}
