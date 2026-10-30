import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, bench, describe } from 'vitest';
import { Flagsmith } from '../index.js';

const IDENTITY_OVERRIDES_IDENTIFIER = 'identity-override-1';
const IDENTIFIER = 'user-1';
const TRAITS = {
    plan: 'plan-7',
    age: 30,
    country: 'GB',
    version: '2.5.1',
    email: 'jane@example.com',
    user_id: 12,
    beta: true,
    score: 95,
    tier: 'pro',
    device: 'iPhone 15'
};
const BENCH_OPTIONS = { throws: true };

/**
 * Build a locally evaluating client serving the environment document from memory.
 */
async function buildClient(environment: string): Promise<Flagsmith> {
    const fixturesDir = process.env.SDK_BENCHMARKS_DIR;
    if (!fixturesDir) {
        throw new Error('SDK_BENCHMARKS_DIR must point to the sdk-benchmarks fixtures');
    }
    const environmentDocument = readFileSync(
        join(fixturesDir, 'environments', `${environment}.json`),
        'utf-8'
    );
    const client = new Flagsmith({
        environmentKey: 'ser.benchmark',
        apiUrl: 'http://flagsmith.benchmark/api/v1/',
        fetch: async () => new Response(environmentDocument, { status: 200 }),
        enableLocalEvaluation: true,
        environmentRefreshIntervalSeconds: 86400 // Refreshed by benchmarks only
    });
    await client.getEnvironment();
    return client;
}

for (const environment of ['small', 'medium', 'large']) {
    const client = await buildClient(environment);

    describe(`${environment} environment`, () => {
        afterAll(async () => {
            await client.close();
        });

        bench(
            'getEnvironmentFlags',
            async () => {
                (await client.getEnvironmentFlags()).getFeatureValue('feature_1');
            },
            BENCH_OPTIONS
        );

        bench(
            'getIdentityFlagsWithIdentityOverrides',
            async () => {
                (await client.getIdentityFlags(IDENTITY_OVERRIDES_IDENTIFIER)).isFeatureEnabled(
                    'feature_8'
                );
            },
            BENCH_OPTIONS
        );

        bench(
            'getIdentityFlagsNoTraits',
            async () => {
                (await client.getIdentityFlags(IDENTIFIER)).getFeatureValue('feature_1');
            },
            BENCH_OPTIONS
        );

        bench(
            'getIdentityFlagsWithTraits',
            async () => {
                (await client.getIdentityFlags(IDENTIFIER, TRAITS)).getFeatureValue('feature_1');
            },
            BENCH_OPTIONS
        );

        bench(
            'getIdentitySegmentsWithTraits',
            async () => {
                await client.getIdentitySegments(IDENTIFIER, TRAITS);
            },
            BENCH_OPTIONS
        );
    });
}
