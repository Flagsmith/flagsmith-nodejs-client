import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util.js';
import { AnalyticsProcessor } from '../../sdk/analytics.js';
import { EventProcessor, EventProcessorOptions } from '../../sdk/events.js';
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

export function eventProcessor(params: Partial<EventProcessorOptions> = {}) {
    return new EventProcessor({
        environmentKey: 'test-key',
        eventsApiUrl: 'http://testUrl/',
        // Tests drive flushing explicitly unless they opt in to the timer.
        flushInterval: 0,
        retryBackoffMs: 0,
        fetch: (url, options) => fetch(url.toString(), options),
        ...params
    });
}

/**
 * The events posted to the events API by the mocked fetch, flattened across all batches.
 */
export function postedEvents(): any[] {
    return fetch.mock.calls
        .filter(([url]) => String(url).includes('/v1/events'))
        .flatMap(([, options]) => JSON.parse(String(options?.body ?? '{}'))['events'] ?? []);
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
