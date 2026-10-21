import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseJsonc } from 'jsonc-parser';
import { bench, describe } from 'vitest';
import { getEvaluationResult } from '../../flagsmith-engine/index.js';
import { EvaluationContextWithMetadata } from '../../flagsmith-engine/evaluation/models.js';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util.js';
import { Flagsmith } from '../../sdk/index.js';
import { BaseOfflineHandler } from '../../sdk/offline_handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_CASES_DIR = path.join(__dirname, '../engine/engine-tests/engine-test-data/test_cases');
const FEATURE_COUNT = 100;
const SEGMENT_COUNT = 50;
const DEPENDENCY_CHAIN_LENGTH = 10;

const testCaseContexts = fs
    .readdirSync(TEST_CASES_DIR)
    .map(file => fs.readFileSync(path.join(TEST_CASES_DIR, file), 'utf-8'))
    .map(content => ({
        readsFlags: content.includes('$.flags'),
        context: parseJsonc(content).context as EvaluationContextWithMetadata
    }));
const flagIndependentContexts = testCaseContexts.filter(c => !c.readsFlags).map(c => c.context);
const flagDependentContexts = testCaseContexts.filter(c => c.readsFlags).map(c => c.context);

const range = (length: number) => Array.from({ length }, (_, i) => i + 1);

const featureState = (id: number, enabled: boolean, value: string, variants = 0) => ({
    feature: { id, name: `feature_${id}`, type: variants ? 'MULTIVARIATE' : 'STANDARD' },
    featurestate_uuid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    django_id: id,
    feature_state_value: value,
    enabled,
    multivariate_feature_state_values: Array.from({ length: variants }, (_, v) => ({
        id: id * 10 + v,
        mv_fs_value_uuid: `00000000-0000-0000-0001-${String(id * 10 + v).padStart(12, '0')}`,
        percentage_allocation: 30,
        multivariate_feature_option: { id: id * 10 + v, value: `variant_${v}` }
    }))
});

const condition = (property_: string, operator: string, value: string) => ({
    property_,
    operator,
    value
});

const segment = (id: number, conditions: object[], overriddenFeatureId: number) => ({
    id,
    name: `segment_${id}`,
    rules: [{ type: 'ALL', conditions: [], rules: [{ type: 'ALL', conditions, rules: [] }] }],
    feature_states: [featureState(overriddenFeatureId, true, `segment_${id}_value`)]
});

const largeEnvironmentDocument = (withFlagDependencies: boolean) => ({
    api_key: 'benchmark-environment-key',
    name: 'Benchmark environment',
    id: 1,
    project: {
        id: 1,
        name: 'Benchmark project',
        hide_disabled_flags: false,
        organisation: {
            id: 1,
            name: 'Benchmark organisation',
            feature_analytics: false,
            persist_trait_data: true,
            stop_serving_flags: false
        },
        segments: [
            ...range(SEGMENT_COUNT).map(id =>
                segment(
                    id,
                    [
                        condition('plan', 'EQUAL', `plan_${id % 5}`),
                        condition('age', 'GREATER_THAN', String(id))
                    ],
                    id
                )
            ),
            ...(withFlagDependencies
                ? range(DEPENDENCY_CHAIN_LENGTH).map(link =>
                      segment(
                          SEGMENT_COUNT + link,
                          [
                              condition(
                                  `$.flags.feature_${
                                      link > 1 ? SEGMENT_COUNT + link - 1 : 2
                                  }.enabled`,
                                  'EQUAL',
                                  'true'
                              )
                          ],
                          SEGMENT_COUNT + link
                      )
                  )
                : [])
        ]
    },
    feature_states: range(FEATURE_COUNT).map(id =>
        featureState(id, id % 2 === 0, `value_${id}`, id % 10 === 0 ? 2 : 0)
    ),
    identity_overrides: []
});

class DocumentOfflineHandler extends BaseOfflineHandler {
    private readonly environment;
    constructor(environmentDocument: object) {
        super();
        this.environment = buildEnvironmentModel(environmentDocument);
    }
    getEnvironment() {
        return this.environment;
    }
}

const offlineFlagsmith = (environmentDocument: object) =>
    new Flagsmith({
        offlineMode: true,
        offlineHandler: new DocumentOfflineHandler(environmentDocument)
    });

const traits = {
    plan: 'plan_2',
    age: 30,
    ...Object.fromEntries(range(8).map(i => [`trait_${i}`, `value_${i}`]))
};

describe('engine-test-data', () => {
    bench(`${flagIndependentContexts.length} contexts not reading flags`, () => {
        for (const context of flagIndependentContexts) getEvaluationResult(context);
    });
    bench(`${flagDependentContexts.length} contexts reading flags`, () => {
        for (const context of flagDependentContexts) getEvaluationResult(context);
    });
});

describe('SDK offline evaluation, sdk/data/environment.json', () => {
    const flagsmith = offlineFlagsmith(
        JSON.parse(fs.readFileSync(path.join(__dirname, '../sdk/data/environment.json'), 'utf-8'))
    );
    bench('environment flags', async () => {
        await flagsmith.getEnvironmentFlags();
    });
    bench('identity flags', async () => {
        await flagsmith.getIdentityFlags('identity', { age: 21 });
    });
});

describe(`SDK offline evaluation, ${FEATURE_COUNT} features and ${SEGMENT_COUNT} segments`, () => {
    const flagsmith = offlineFlagsmith(largeEnvironmentDocument(false));
    bench('environment flags', async () => {
        await flagsmith.getEnvironmentFlags();
    });
    bench('identity flags', async () => {
        await flagsmith.getIdentityFlags('identity', traits);
    });
});

describe(`SDK offline evaluation, plus a chain of ${DEPENDENCY_CHAIN_LENGTH} flag dependencies`, () => {
    const flagsmith = offlineFlagsmith(largeEnvironmentDocument(true));
    bench('identity flags', async () => {
        await flagsmith.getIdentityFlags('identity', traits);
    });
});
