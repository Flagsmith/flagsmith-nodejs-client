import { createHash } from 'crypto';
import { Fetch, FlagsmithTraitValue, TraitConfig } from './types.js';
import { Dispatcher } from 'undici-types';

type Traits = { [key: string]: TraitConfig | FlagsmithTraitValue };

const FLAGSMITH_USER_AGENT = 'flagsmith-nodejs-sdk';
const FLAGSMITH_UNKNOWN_VERSION = 'unknown';

export function isTraitConfig(
    traitValue: TraitConfig | FlagsmithTraitValue
): traitValue is TraitConfig {
    return !!traitValue && typeof traitValue == 'object' && traitValue.value !== undefined;
}

export function generateIdentitiesData(identifier: string, traits: Traits, transient: boolean) {
    const traitsGenerated = Object.entries(traits).map(([key, value]) => {
        if (isTraitConfig(value)) {
            return {
                trait_key: key,
                trait_value: value?.value,
                transient: value?.transient
            };
        } else {
            return {
                trait_key: key,
                trait_value: value
            };
        }
    });
    if (transient) {
        return {
            identifier: identifier,
            traits: traitsGenerated,
            transient: true
        };
    }
    return {
        identifier: identifier,
        traits: traitsGenerated
    };
}

export function generateIdentityCacheKey(identifier: string, traits?: Traits): string {
    if (!traits || Object.keys(traits).length === 0) {
        return `flags-${identifier}`;
    }

    const normalized: [string, FlagsmithTraitValue][] = [];
    for (const key of Object.keys(traits).sort()) {
        const raw = traits[key];
        const value = isTraitConfig(raw) ? raw.value : raw;
        if (value === undefined) continue;
        normalized.push([key, value]);
    }

    if (normalized.length === 0) {
        return `flags-${identifier}`;
    }

    const serialized = JSON.stringify(normalized);
    const hash = createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    return `flags-${identifier}-${hash}`;
}

export const delay = (ms: number) =>
    new Promise(resolve => setTimeout(() => resolve(undefined), ms));

export const retryFetch = (
    url: string,
    // built-in RequestInit type doesn't have dispatcher/agent
    fetchOptions: RequestInit & { dispatcher?: Dispatcher },
    retries: number = 3,
    timeoutMs: number = 10, // set an overall timeout for this function
    retryDelayMs: number = 1000,
    customFetch: Fetch
): Promise<Response> => {
    const retryWrapper = async (n: number): Promise<Response> => {
        try {
            return await customFetch(url, {
                ...fetchOptions,
                signal: AbortSignal.timeout(timeoutMs)
            });
        } catch (e) {
            if (n > 0) {
                await delay(retryDelayMs);
                return await retryWrapper(n - 1);
            } else {
                throw e;
            }
        }
    };
    return retryWrapper(retries);
};

/**
 * A deferred promise can be resolved or rejected outside its creation scope.
 *
 * @template T The type of the value that the deferred promise will resolve to.
 *
 * @example
 * const deferred = new Deferred<string>()
 *
 * // Pass the promise somewhere
 * performAsyncOperation(deferred.promise)
 *
 * // Resolve it when ready from anywhere
 * deferred.resolve("Operation completed")
 * deferred.failed("Error")
 */
export class Deferred<T> {
    public readonly promise: Promise<T>;
    private resolvePromise!: (value: T | PromiseLike<T>) => void;
    private rejectPromise!: (reason?: unknown) => void;

    constructor(initial?: T) {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
        });
    }

    public resolve(value: T | PromiseLike<T>): void {
        this.resolvePromise(value);
    }

    public reject(reason?: unknown): void {
        this.rejectPromise(reason);
    }
}

export function getUserAgent(): string {
    try {
        const packageJson = require('../package.json');
        const version = packageJson?.version;
        return version ? `${FLAGSMITH_USER_AGENT}/${version}` : FLAGSMITH_UNKNOWN_VERSION;
    } catch {
        return FLAGSMITH_UNKNOWN_VERSION;
    }
}
