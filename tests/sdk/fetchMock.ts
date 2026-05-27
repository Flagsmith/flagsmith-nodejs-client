import { readFileSync } from 'fs';

const DATA_DIR = __dirname + '/data/';

export const environmentJSON = readFileSync(DATA_DIR + 'environment.json', 'utf-8');
export const flagsJSON = readFileSync(DATA_DIR + 'flags.json', 'utf-8');
export const identitiesJSON = readFileSync(DATA_DIR + 'identities.json', 'utf-8');

export function fetchImpl(url: string, options?: RequestInit) {
    const headers = options?.headers as Record<string, string>;
    if (!headers) throw new Error('missing request headers');
    const env = headers['X-Environment-Key'];
    if (!env)
        return Promise.resolve(new Response('missing x-environment-key header', { status: 404 }));
    if (url.includes('/environment-document')) {
        if (env.startsWith('ser.')) {
            return Promise.resolve(new Response(environmentJSON, { status: 200 }));
        }
        return Promise.resolve(
            new Response('environment-document called without a server-side key', { status: 401 })
        );
    }
    if (url.includes('/flags')) {
        return Promise.resolve(new Response(flagsJSON, { status: 200 }));
    }
    if (url.includes('/identities')) {
        return Promise.resolve(new Response(identitiesJSON, { status: 200 }));
    }
    return Promise.resolve(new Response('unknown url ' + url, { status: 404 }));
}

export const fetch = vi.fn(fetchImpl);
