import fetch, { Response } from 'node-fetch';
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
    fetchOptions: any,
    retries = 3,
    timeout: number // seconds
): Promise<Response> => {
    return new Promise((resolve, reject) => {
        // check for timeout
        if (timeout) setTimeout(() => reject('error: timeout'), timeout * 1000);

        const wrapper = (n: number) => {
            fetch(url, fetchOptions)
                .then(res => resolve(res))
                .catch(async err => {
                    if (n > 0) {
                        await delay(1000);
                        wrapper(--n);
                    } else {
                        reject(err);
                    }
                });
        };

        wrapper(retries);
    });
};
