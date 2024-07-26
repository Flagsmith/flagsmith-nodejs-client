import fetch, { RequestInit, Response } from 'node-fetch';
import { ITraitConfig } from './types';
// @ts-ignore
if (typeof fetch.default !== 'undefined') fetch = fetch.default;

type Trait = {
    [key: string]: ITraitConfig | any
}

export function isTraitConfig(trait: Trait): trait is Trait {
    return !!trait && typeof trait == 'object' && trait.value !== undefined;
}

export function generateIdentitiesData(identifier: string, traits: Trait, transient: boolean) {
    const traitsGenerated = Object.entries(traits).map((trait) => {
        if(isTraitConfig(trait)) {
            return {
                trait_key: trait[0],
                trait_value: trait[1].value,
                transient: true,
            };
        } else {
            return {
                trait_key: trait[0],
                trait_value: trait[1],
            };
        }
    });
    if (transient) {
        return {
            identifier: identifier,
            traits: traitsGenerated,
            transient: true
        }
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
    timeout: number = 10// set an overall timeout for this function
): Promise<Response> => {
    return new Promise((resolve, reject) => {
        const retryWrapper = (n: number) => {
            requestWrapper()
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

        const requestWrapper = (): Promise<Response> => {
            return new Promise((resolve, reject) => {
                let timeoutId: NodeJS.Timeout;
                if (timeout) {
                    timeoutId = setTimeout(() => reject('error: timeout'), timeout);
                }
                return fetch(url, fetchOptions)
                    .then(res => resolve(res))
                    .catch(err => reject(err))
                    .finally(() => {
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                        }
                    })
            })
        }

        retryWrapper(retries);
    });
};
