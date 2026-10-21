/**
 * Adapter that lets the Flagsmith SDK behavioural spec drive this SDK.
 *
 * Protocol: https://github.com/Flagsmith/sdk-spec/blob/main/ADAPTER.md
 */

import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Flagsmith, type Flags } from '@flagsmith/nodejs';

const SDK_PACKAGE = '@flagsmith/nodejs';
const { version } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.resolve(SDK_PACKAGE)), 'utf8')
);

const clients = new Map<string, Flagsmith>();
let lastClientId = 0;

const CLIENT_ROUTE = /^\/clients\/(?<clientId>[^/]+)(?<action>\/[a-z-]+)?$/;

function serialiseFlags(flags: Flags) {
    return {
        flags: flags.allFlags().map(flag => ({
            featureName: flag.featureName,
            enabled: flag.enabled,
            // The SDK reports a null value as `undefined`, which JSON would drop.
            value: flag.value ?? null
        }))
    };
}

function errorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }
    const message = `${error.name}: ${error.message}`;
    return error.cause ? `${message} (caused by ${errorMessage(error.cause)})` : message;
}

function send(res: ServerResponse, status: number, body?: unknown) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    });
    res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString();
    return raw ? JSON.parse(raw) : {};
}

async function route(req: IncomingMessage, res: ServerResponse) {
    const { method, url: path } = req;

    if (method === 'GET' && path === '/health') {
        return send(res, 200, { sdk: 'flagsmith-nodejs-client', version });
    }

    if (method === 'POST' && path === '/clients') {
        const body = await readBody(req);
        const clientId = String(++lastClientId);
        clients.set(
            clientId,
            new Flagsmith({ environmentKey: body.environmentKey, apiUrl: body.apiUrl })
        );
        return send(res, 201, { clientId });
    }

    const match = CLIENT_ROUTE.exec(path ?? '');
    const client = match && clients.get(match.groups!.clientId);
    if (!match || !client) {
        return send(res, 404, { error: `No route for ${method} ${path}` });
    }
    const { clientId, action } = match.groups!;

    if (method === 'DELETE' && action === undefined) {
        clients.delete(clientId);
        await client.close();
        return send(res, 204);
    }

    if (method === 'POST' && action === '/environment-flags') {
        return send(res, 200, serialiseFlags(await client.getEnvironmentFlags()));
    }

    if (method === 'POST' && action === '/identity-flags') {
        const body = await readBody(req);
        const flags = await client.getIdentityFlags(body.identifier, body.traits ?? {});
        return send(res, 200, serialiseFlags(flags));
    }

    return send(res, 404, { error: `No route for ${method} ${path}` });
}

const server = createServer(async (req, res) => {
    try {
        await route(req, res);
    } catch (error) {
        // Report SDK errors to the runner.
        console.error(error);
        send(res, 500, { error: errorMessage(error) });
    }
    console.log(`adapter: ${req.method} ${req.url} ${res.statusCode}`);
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => console.log(`adapter: listening on :${port}`));
