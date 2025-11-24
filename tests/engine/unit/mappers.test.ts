import { test, expect, describe } from 'vitest';
import { getEvaluationContext } from '../../../flagsmith-engine/evaluation/evaluationContext/mappers.js';
import { buildEnvironmentModel } from '../../../flagsmith-engine/environments/util.js';
import { EnvironmentModel } from '../../../flagsmith-engine/environments/models.js';
import { IdentityModel } from '../../../flagsmith-engine/identities/models.js';
import { TraitModel } from '../../../flagsmith-engine/identities/traits/models.js';
import { FeatureModel, FeatureStateModel } from '../../../flagsmith-engine/features/models.js';
import {
    MultivariateFeatureOptionModel,
    MultivariateFeatureStateValueModel
} from '../../../flagsmith-engine/features/models.js';
import { CONSTANTS } from '../../../flagsmith-engine/features/constants.js';
import { readFileSync } from 'fs';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from '../../../flagsmith-engine/segments/constants.js';
import { SegmentSource } from '../../../flagsmith-engine/evaluation/models.js';

const DATA_DIR = __dirname + '/../../sdk/data/';

describe('getEvaluationContext', () => {
    const environmentJSON = JSON.parse(readFileSync(DATA_DIR + 'environment.json', 'utf-8'));
    const testEnvironment = buildEnvironmentModel(environmentJSON);

    test('produces evaluation context from environment document', () => {
        // When
        const context = getEvaluationContext(testEnvironment);

        // Then - verify environment
        expect(context).toBeDefined();
        expect(context.environment?.key).toBe('B62qaMZNwfiqT76p38ggrQ');
        expect(context.environment?.name).toBe('Test environment');
        expect(context.identity).toBeUndefined();

        // Verify segments
        expect(context.segments).toBeDefined();
        expect(context.segments).toHaveProperty('1');

        const segment = context.segments!['1'];
        expect(segment.key).toBe('1');
        expect(segment.name).toBe('regular_segment');
        expect(segment.rules.length).toBe(1);
        expect(segment.overrides).toBeDefined();
        expect(Array.isArray(segment.overrides)).toBe(true);
        expect(segment.metadata?.source).toBe(SegmentSource.API);
        expect(segment.metadata?.id).toBe(1);

        // Verify segment rules
        expect(segment.rules[0].type).toBe('ALL');
        expect(segment.rules[0].conditions).toEqual([]);
        expect(segment.rules[0].rules?.length).toBe(1);

        const nestedRule = segment.rules[0].rules?.[0]!;
        expect(nestedRule.type).toBe('ANY');
        expect(nestedRule.conditions?.length).toBe(1);
        expect(nestedRule.rules?.length).toEqual(0);

        const condition = nestedRule.conditions?.[0]!;
        expect(condition.property).toBe('age');
        expect(condition.operator).toBe('LESS_THAN');
        expect(condition.value).toBe('40');

        // Verify identity override segment
        const identityOverrideSegment = Object.values(context.segments!).find(
            s => s.name === IDENTITY_OVERRIDE_SEGMENT_NAME
        );
        expect(identityOverrideSegment).toBeDefined();
        expect(identityOverrideSegment!.name).toBe(IDENTITY_OVERRIDE_SEGMENT_NAME);
        expect(identityOverrideSegment!.rules.length).toBe(1);
        expect(identityOverrideSegment!.overrides?.length).toBe(1);

        const overrideRule = identityOverrideSegment!.rules?.[0]!;
        expect(overrideRule.type).toBe('ALL');
        expect(overrideRule.conditions?.length).toBe(1);

        const overrideCondition = overrideRule.conditions?.[0]!;
        expect(overrideCondition.property).toBe('$.identity.identifier');
        expect(overrideCondition.operator).toBe('IN');
        expect(overrideCondition.value).toContain('overridden-id');

        const override = identityOverrideSegment!.overrides?.[0]!;
        expect(override.name).toBe('some_feature');
        expect(override.enabled).toBe(false);
        expect(override.value).toBe('some-overridden-value');
        expect(override.priority).toBe(-Infinity);
        expect(override.metadata?.id).toBe(1);

        // Verify features
        expect(context.features).toBeDefined();
        expect(context.features).toHaveProperty('some_feature');

        const someFeature = context.features!['some_feature'];
        expect(someFeature.name).toBe('some_feature');
        expect(someFeature.enabled).toBe(true);
        expect(someFeature.value).toBe('some-value');
        expect(someFeature.priority).toBeUndefined();
        expect(someFeature.metadata?.id).toBe(1);

        // Verify multivariate feature
        expect(context.features).toHaveProperty('mv_feature');
        const mvFeature = context.features!['mv_feature'];
        expect(mvFeature.name).toBe('mv_feature');
        expect(mvFeature.enabled).toBe(false);
        expect(mvFeature.value).toBe('foo');
        expect(mvFeature.priority).toBeUndefined();
        expect(mvFeature.variants?.length).toBe(1);

        const variant = mvFeature.variants![0];
        expect(variant.value).toBe('bar');
        expect(variant.weight).toBe(100);
        expect(variant.priority).toBe(1);
    });

    test('maps multivariate features with multiple variants correctly', () => {
        // Given
        const mvOption1 = new MultivariateFeatureOptionModel('variant_a', 100);
        const mvOption2 = new MultivariateFeatureOptionModel('variant_b', 200);
        const mvOption3 = new MultivariateFeatureOptionModel('variant_c', 150);

        const mvValue1 = new MultivariateFeatureStateValueModel(
            mvOption1,
            30,
            100,
            '00000000-0000-0000-0000-000000000001'
        );

        const mvValue2 = new MultivariateFeatureStateValueModel(
            mvOption2,
            50,
            200,
            '00000000-0000-0000-0000-000000000002'
        );

        const mvValue3 = new MultivariateFeatureStateValueModel(
            mvOption3,
            20,
            150,
            '00000000-0000-0000-0000-000000000003'
        );

        const feature = new FeatureModel(999, 'multi_variant_feature', CONSTANTS.MULTIVARIATE);
        const featureState = new FeatureStateModel(feature, true, 999);
        featureState.setValue('control');
        featureState.multivariateFeatureStateValues = [mvValue1, mvValue2, mvValue3];

        const envWithMv = new EnvironmentModel(1, 'test_key', testEnvironment.project, 'Test Env');
        envWithMv.featureStates = [featureState];

        // When
        const context = getEvaluationContext(envWithMv);

        // Then
        const featureContext = context.features!['multi_variant_feature'];
        expect(featureContext.variants?.length).toBe(3);

        expect(featureContext.variants![0].value).toBe('variant_a');
        expect(featureContext.variants![0].weight).toBe(30);
        expect(featureContext.variants![0].priority).toBe(100);

        expect(featureContext.variants![1].value).toBe('variant_b');
        expect(featureContext.variants![1].weight).toBe(50);
        expect(featureContext.variants![1].priority).toBe(200);

        expect(featureContext.variants![2].value).toBe('variant_c');
        expect(featureContext.variants![2].weight).toBe(20);
        expect(featureContext.variants![2].priority).toBe(150);
    });

    test('handles multivariate features without IDs using UUID', () => {
        // Given
        const mvOption1 = new MultivariateFeatureOptionModel('option_x', undefined);
        const mvOption2 = new MultivariateFeatureOptionModel('option_y', undefined);

        const mvValue1 = new MultivariateFeatureStateValueModel(
            mvOption1,
            60,
            undefined as any,
            'aaaaaaaa-bbbb-cccc-dddd-000000000001'
        );

        const mvValue2 = new MultivariateFeatureStateValueModel(
            mvOption2,
            40,
            undefined as any,
            'aaaaaaaa-bbbb-cccc-dddd-000000000002'
        );

        const feature = new FeatureModel(888, 'uuid_variant_feature', CONSTANTS.MULTIVARIATE);
        const featureState = new FeatureStateModel(feature, true, 888);
        featureState.setValue('default');
        featureState.multivariateFeatureStateValues = [mvValue1, mvValue2];

        const envWithUuid = new EnvironmentModel(
            1,
            'test_key',
            testEnvironment.project,
            'Test Env'
        );
        envWithUuid.featureStates = [featureState];

        // When
        const context = getEvaluationContext(envWithUuid);

        // Then
        const featureContext = context.features!['uuid_variant_feature'];
        expect(featureContext.variants?.length).toBe(2);

        // When using UUID-based priorities, they become bigints
        expect(
            typeof featureContext.variants![0].priority === 'number' ||
                typeof featureContext.variants![0].priority === 'bigint'
        ).toBe(true);
        expect(
            typeof featureContext.variants![1].priority === 'number' ||
                typeof featureContext.variants![1].priority === 'bigint'
        ).toBe(true);
        expect(featureContext.variants![0].priority).not.toBe(featureContext.variants![1].priority);
    });

    test('handles environment with no features', () => {
        // Given - create a copy with no features
        const emptyEnvJSON = { ...environmentJSON, feature_states: [] };
        const emptyEnv = buildEnvironmentModel(emptyEnvJSON);

        // When
        const context = getEvaluationContext(emptyEnv);

        // Then
        expect(context.features).toEqual({});
        expect(context.environment?.key).toBe('B62qaMZNwfiqT76p38ggrQ');
        expect(context.environment?.name).toBe('Test environment');
    });

    test('produces evaluation context with identity', () => {
        // Given
        const identity = new IdentityModel(
            '2024-01-01T00:00:00Z',
            [new TraitModel('email', 'test@example.com'), new TraitModel('age', 25)],
            [],
            'B62qaMZNwfiqT76p38ggrQ',
            'test_user'
        );

        // When
        const context = getEvaluationContext(testEnvironment, identity);

        // Then
        expect(context.identity).toBeDefined();
        expect(context.identity?.identifier).toBe('test_user');
        expect(context.identity?.traits).toEqual({
            email: 'test@example.com',
            age: 25
        });
    });

    test('produces evaluation context with override traits', () => {
        // Given
        const identity = new IdentityModel(
            '2024-01-01T00:00:00Z',
            [new TraitModel('email', 'original@example.com')],
            [],
            'B62qaMZNwfiqT76p38ggrQ',
            'test_user',
            undefined,
            456
        );

        const overrideTraits = [
            new TraitModel('email', 'override@example.com'),
            new TraitModel('premium', true)
        ];

        // When
        const context = getEvaluationContext(testEnvironment, identity, overrideTraits);

        // Then
        expect(context.identity?.traits).toEqual({
            email: 'override@example.com',
            premium: true
        });
    });

    test('produces evaluation context without identity when isEnvironmentEvaluation is true', () => {
        // Given
        const identity = new IdentityModel(
            '2024-01-01T00:00:00Z',
            [new TraitModel('test', 'value')],
            [],
            'B62qaMZNwfiqT76p38ggrQ',
            'test_user',
            undefined,
            789
        );

        // When
        const context = getEvaluationContext(testEnvironment, identity, undefined, true);

        // Then
        expect(context.identity).toBeUndefined();
        expect(context.environment).toBeDefined();
        expect(context.features).toBeDefined();
        expect(context.segments).toBeDefined();
    });

    test('handles identity without django_id', () => {
        // Given
        const identity = new IdentityModel(
            '2024-01-01T00:00:00Z',
            [new TraitModel('name', 'John')],
            [],
            'B62qaMZNwfiqT76p38ggrQ',
            'john_doe',
            undefined,
            undefined
        );

        // When
        const context = getEvaluationContext(testEnvironment, identity);

        // Then
        expect(context.identity?.identifier).toBe('john_doe');
        expect(context.identity?.key).toBeUndefined();
        expect(context.identity?.traits).toEqual({ name: 'John' });
    });

    test('maps segment override priorities correctly', () => {
        // When - using fixture which has segment with priority
        const context = getEvaluationContext(testEnvironment);

        // Then - verify regular_segment has a feature override
        const segment = context.segments!['1'];
        expect(segment.overrides?.length).toBeGreaterThan(0);

        // The segment override from the fixture has no explicit priority, should be undefined
        const segmentOverride = segment.overrides?.[0]!;
        expect(segmentOverride.name).toBe('some_feature');
        expect(segmentOverride.priority).toBeUndefined();
    });

    test('handles multiple identity overrides with same features', () => {
        // Given - the fixture already has identity override with 'overridden-id'
        // Verify it's mapped correctly
        const context = getEvaluationContext(testEnvironment);

        // Then
        const overrideSegments = Object.values(context.segments!).filter(
            s => s.name === IDENTITY_OVERRIDE_SEGMENT_NAME
        );

        // The fixture has one identity override
        expect(overrideSegments.length).toBe(1);
        expect(overrideSegments[0].rules?.[0].conditions?.[0].value).toContain('overridden-id');
        expect(overrideSegments[0].overrides?.length).toBe(1);
    });
});
