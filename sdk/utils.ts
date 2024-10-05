import fetch, { RequestInit, Response } from 'node-fetch';
import { FlagsmithTraitValue, ITraitConfig } from './types';
// @ts-ignore
if (typeof fetch.default !== 'undefined') fetch = fetch.default;

type Traits = { [key: string]: ITraitConfig | FlagsmithTraitValue };

export function isTraitConfig(
    traitValue: ITraitConfig | FlagsmithTraitValue
): traitValue is ITraitConfig {
    return !!traitValue && typeof traitValue == 'object' && traitValue.value !== undefined;
}

export function generateIdentitiesData(identifier: string, traits: Traits, transient: boolean) {
    const traitsGenerated = Object.entries(traits).map(([key, value]) => {
        if (isTraitConfig(value)) {
            return {
                trait_key: key,
                trait_value: value?.value,
                transient: value?.transient,
            };
        } else {
            return {
                trait_key: key,
                trait_value: value,
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

export const delay = (ms: number) =>
    new Promise(resolve => setTimeout(() => resolve(undefined), ms));

export const retryFetch = (
    url: string,
    fetchOptions: RequestInit,
    retries: number = 3,
    timeoutMs: number = 10 // set an overall timeout for this function
): Promise<Response> => {
    return new Promise((resolve, reject) => {
        const retryWrapper = (n: number) => {
            fetch(url, {
                ...fetchOptions,
                signal: AbortSignal.timeout(timeoutMs)
            })
            .then(res => resolve(res))
            .catch(async err => {
                if (n > 0) {
                    await delay(1000);
                    retryWrapper(--n);
                } else {
                    reject(err);
                }
            });

        };

        retryWrapper(retries);
    });
};
