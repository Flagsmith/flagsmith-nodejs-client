import {
    evaluateFeatures,
    evaluateSegments,
    getEvaluationResult,
    isHigherPriority,
    SegmentOverrides,
    shouldApplyOverride
} from '../../../flagsmith-engine/index.js';
import { CONSTANTS } from '../../../flagsmith-engine/features/constants.js';
import { FeatureModel, FeatureStateModel } from '../../../flagsmith-engine/features/models.js';
import { TraitModel } from '../../../flagsmith-engine/identities/traits/models.js';
import {
    environment,
    environmentWithSegmentOverride,
    feature1,
    identity,
    identityInSegment,
    segmentConditionProperty,
    segmentConditionStringValue
} from './utils.js';
import { getEvaluationContext } from '../../../flagsmith-engine/evaluation/evaluationContext/mappers.js';
import { TARGETING_REASONS } from '../../../flagsmith-engine/features/types.js';
import { EvaluationContext } from '../../../flagsmith-engine/evaluation/evaluationContext/evaluationContext.types.js';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from '../../../flagsmith-engine/segments/constants.js';

test('test_get_evaluation_result_without_any_override', () => {
    const context = getEvaluationContext(environment(), identity());
    const result = getEvaluationResult(context);

    const flag = Object.values(result.flags).find(f => f.name === feature1().name);
    expect(flag).toBeDefined();
    expect(flag?.name).toBe(feature1().name);
    expect(flag?.feature_key).toBe(feature1().id.toString());
    expect(flag?.reason).toBe(TARGETING_REASONS.DEFAULT);
});

test('test_get_evaluation_result_with_identity_override_and_no_segment_override', () => {
    const env = environment();
    const ident = identity();
    const overridden_feature = new FeatureModel(3, 'overridden_feature', CONSTANTS.STANDARD);

    env.featureStates.push(new FeatureStateModel(overridden_feature, false, 3));
    ident.identityFeatures = [new FeatureStateModel(overridden_feature, true, 4)];
    env.identityOverrides = [ident];

    const context = getEvaluationContext(env, ident);
    const result = getEvaluationResult(context);

    expect(Object.keys(result.flags).length).toBe(3);

    for (const flag of Object.values(result.flags)) {
        const environmentFeature = Object.values(context.features || {}).find(
            f => f.name === flag.name
        );

        const expected = flag.name === 'overridden_feature' ? true : environmentFeature?.enabled;

        expect(flag.enabled).toBe(expected);
        expect(flag.reason).toBe(
            flag.name === 'overridden_feature'
                ? `${TARGETING_REASONS.TARGETING_MATCH}; segment=${IDENTITY_OVERRIDE_SEGMENT_NAME}`
                : TARGETING_REASONS.DEFAULT
        );
    }
});

test('test_identity_get_all_feature_states_with_traits', () => {
    const trait_models = new TraitModel(segmentConditionProperty, segmentConditionStringValue);

    const context = getEvaluationContext(environmentWithSegmentOverride(), identityInSegment(), [
        trait_models
    ]);

    const result = getEvaluationResult(context);

    const overriddenFlag = Object.values(result.flags).find(f => f.value === 'segment_override');
    expect(overriddenFlag).toBeDefined();
    expect(overriddenFlag?.value).toBe('segment_override');
    expect(overriddenFlag?.reason).toEqual(
        `${TARGETING_REASONS.TARGETING_MATCH}; segment=test name`
    );
});

test('test_environment_get_all_feature_states', () => {
    const env = environment();
    const context = getEvaluationContext(env);
    const result = getEvaluationResult(context);

    expect(Object.keys(result.flags).length).toBe(Object.keys(context.features || {}).length);

    Object.values(result.flags).forEach(flag => {
        expect(flag.reason).toBe(TARGETING_REASONS.DEFAULT);
    });

    for (const flag of Object.values(result.flags)) {
        const envFeature = Object.values(context.features || {}).find(f => f.name === flag.name);
        expect(flag.enabled).toBe(envFeature?.enabled);
        expect(flag.value).toBe(envFeature?.value);
    }
});

test('isHigherPriority should handle undefined priorities correctly', () => {
    expect(isHigherPriority(1, 2)).toBe(true);
    expect(isHigherPriority(2, 1)).toBe(false);
    expect(isHigherPriority(undefined, 5)).toBe(false);
    expect(isHigherPriority(5, undefined)).toBe(true);
    expect(isHigherPriority(undefined, undefined)).toBe(false);
});

test('shouldApplyOverride with priority conflicts', () => {
    const existingOverrides: SegmentOverrides = {
        feature1: {
            feature: {
                key: 'key',
                feature_key: 'feature1',
                name: 'name',
                enabled: true,
                value: 'value',
                priority: 5
            },
            segmentName: 'segment1'
        }
    };

    expect(shouldApplyOverride({ feature_key: 'feature1', priority: 2 }, existingOverrides)).toBe(
        true
    );
    expect(shouldApplyOverride({ feature_key: 'feature1', priority: 10 }, existingOverrides)).toBe(
        false
    );
});

test('evaluateSegments handles segments with identity identifier matching', () => {
    const context: EvaluationContext = {
        environment: {
            key: 'test-env',
            name: 'Test Environment'
        },
        identity: {
            key: 'test-user',
            identifier: 'test-user'
        },
        segments: {
            '1': {
                key: '1',
                name: 'segment_with_no_overrides',
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user'
                            }
                        ]
                    }
                ],
                overrides: []
            },
            '2': {
                key: '2',
                name: 'segment_with_overrides',
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user'
                            }
                        ]
                    }
                ],
                overrides: [
                    {
                        key: 'override1',
                        feature_key: 'feature1',
                        name: 'feature1',
                        enabled: true,
                        value: 'overridden_value',
                        priority: 1
                    }
                ]
            }
        },
        features: {
            feature1: {
                key: 'fs1',
                feature_key: 'feature1',
                name: 'feature1',
                enabled: false,
                value: 'default_value'
            }
        }
    };

    const result = evaluateSegments(context);

    expect(result.segments).toHaveLength(2);
    expect(result.segments).toEqual(
        expect.arrayContaining([
            { key: '1', name: 'segment_with_no_overrides' },
            { key: '2', name: 'segment_with_overrides' }
        ])
    );

    expect(Object.keys(result.segmentOverrides)).toEqual(['feature1']);
    expect(result.segmentOverrides.feature1.segmentName).toBe('segment_with_overrides');
});

test('evaluateSegments handles priority conflicts correctly', () => {
    const context: EvaluationContext = {
        environment: {
            key: 'test-env',
            name: 'Test Environment'
        },
        identity: {
            key: 'test-user',
            identifier: 'test-user'
        },
        segments: {
            '1': {
                key: '1',
                name: 'low_priority_segment',
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user'
                            }
                        ]
                    }
                ],
                overrides: [
                    {
                        key: 'override1',
                        feature_key: 'feature1',
                        name: 'feature1',
                        enabled: true,
                        value: 'low_priority_value',
                        priority: 10
                    }
                ]
            },
            '2': {
                key: '2',
                name: 'high_priority_segment',
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user'
                            }
                        ]
                    }
                ],
                overrides: [
                    {
                        key: 'override2',
                        feature_key: 'feature1',
                        name: 'feature1',
                        enabled: false,
                        value: 'high_priority_value',
                        priority: 1
                    }
                ]
            }
        },
        features: {
            feature1: {
                key: 'fs1',
                feature_key: 'feature1',
                name: 'feature1',
                enabled: false,
                value: 'default_value'
            }
        }
    };

    const result = evaluateSegments(context);

    expect(result.segments).toHaveLength(2);

    expect(result.segmentOverrides.feature1.segmentName).toBe('high_priority_segment');
    expect(result.segmentOverrides.feature1.feature.value).toBe('high_priority_value');
    expect(result.segmentOverrides.feature1.feature.priority).toBe(1);
});

test('evaluateSegments with non-matching identity returns empty', () => {
    const context: EvaluationContext = {
        environment: {
            key: 'test-env',
            name: 'Test Environment'
        },
        identity: {
            key: 'test-user',
            identifier: 'test-user'
        },
        segments: {
            '1': {
                key: '1',
                name: 'segment_for_specific_user',
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user-123'
                            }
                        ]
                    }
                ],
                overrides: [
                    {
                        key: 'override1',
                        feature_key: 'feature1',
                        name: 'feature1',
                        enabled: true,
                        value: 'overridden_value'
                    }
                ]
            }
        },
        features: {}
    };

    const result = evaluateSegments(context);

    expect(result.segments).toEqual([]);
    expect(result.segmentOverrides).toEqual({});
});

test('evaluateFeatures with multivariate evaluation', () => {
    const context = {
        features: {
            mv_feature: {
                key: 'mv',
                feature_key: 'mv_feature',
                name: 'Multivariate Feature',
                enabled: true,
                value: 'default',
                variants: [
                    { value: 'variant_a', weight: 0 },
                    { value: 'variant_b', weight: 100 }
                ]
            }
        },
        identity: { key: 'test_user', identifier: 'test_user' },
        environment: {
            key: 'test_env',
            name: 'Test Environment'
        }
    };

    const flags = evaluateFeatures(context, {});
    expect(flags['Multivariate Feature'].value).toBe('variant_b');
});
