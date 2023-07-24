import fetch, { RequestInit, Response } from 'node-fetch';
// @ts-ignore
if (typeof fetch.default !== 'undefined') fetch = fetch.default;

export function generateIdentitiesData(identifier: string, traits: { [key: string]: any }) {
    const traitsGenerated = Object.entries(traits).map(trait => ({
        trait_key: trait[0],
        trait_value: trait[1]
    }));
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
    timeout?: number = 10// set an overall timeout for this function
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
                if (timeout) setTimeout(() => reject('error: timeout'), timeout);
                return fetch(url, fetchOptions)
                    .then(res => resolve(res))
                    .catch(err => reject(err))
            })
        }

        retryWrapper(retries);
    });
};
