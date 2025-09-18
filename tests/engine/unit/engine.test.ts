import { getEvaluationResult } from '../../../flagsmith-engine/index.js';
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
import { getEvaluationContext } from '../../../flagsmith-engine/evaluationContext/mappers.js';

test('test_get_evaluation_result_without_any_override', () => {
    const context = getEvaluationContext(environment(), identity());
    const result = getEvaluationResult(context);

    const flag = result.flags.find(f => f.name === feature1().name);
    expect(flag).toBeDefined();
    expect(flag?.name).toBe(feature1().name);
    expect(flag?.feature_key).toBe(feature1().id.toString());
    expect(flag?.reason).toBe('DEFAULT');
});

// CHECK IF THIS TEST IS STILL NEEDED
// test('test_identity_get_feature_state_from_contextwithout_any_override_no_fs', () => {
//     expect(() => {
//         const context = getEvaluationContext(environment(), identity());
//         getIdentityFeatureStateFromContext(context, 'nonExistentName');
//     }).toThrowError('Feature State Not Found');
// });

test('test_get_evaluation_result_with_identity_override_and_no_segment_override', () => {
    const env = environment();
    const ident = identity();
    const overridden_feature = new FeatureModel(3, 'overridden_feature', CONSTANTS.STANDARD);

    env.featureStates.push(new FeatureStateModel(overridden_feature, false, 3));
    ident.identityFeatures = [new FeatureStateModel(overridden_feature, true, 4)];

    const context = getEvaluationContext(env, ident);
    const result = getEvaluationResult(context);

    expect(result.flags.length).toBe(3);

    for (const flag of result.flags) {
        const environmentFeature = Object.values(context.features || {}).find(
            f => f.name === flag.name
        );

        const expected = flag.name === 'overridden_feature' ? true : environmentFeature?.enabled;

        expect(flag.enabled).toBe(expected);
        expect(flag.reason).toBe(
            flag.name === 'overridden_feature' ? 'IDENTITY_OVERRIDE' : 'DEFAULT'
        );
    }
});

test('test_identity_get_all_feature_states_with_traits', () => {
    const trait_models = new TraitModel(segmentConditionProperty, segmentConditionStringValue);

    const context = getEvaluationContext(environmentWithSegmentOverride(), identityInSegment(), [
        trait_models
    ]);

    const result = getEvaluationResult(context);

    const overriddenFlag = result.flags.find(f => f.value === 'segment_override');
    expect(overriddenFlag).toBeDefined();
    expect(overriddenFlag?.value).toBe('segment_override');
    expect(overriddenFlag?.reason).toEqual('TARGETING_MATCH; segment=test name');
});

// TO CONFIRM ITS REMOVED
// test('test_identity_get_all_feature_states_with_traits_hideDisabledFlags', () => {
//     const trait_models = new TraitModel(segmentConditionProperty, segmentConditionStringValue);

//     const env = environmentWithSegmentOverride();

//     const context = getEvaluationContext(env, identityInSegment(), [trait_models]);
//     const result = getEvaluationResult(context, true);

//     expect(result.flags.length).toBe(0);
// });

test('test_environment_get_all_feature_states', () => {
    const env = environment();
    const context = getEvaluationContext(env);
    const result = getEvaluationResult(context);

    expect(result.flags.length).toBe(Object.keys(context.features || {}).length);

    result.flags.forEach(flag => {
        expect(flag.reason).toBe('DEFAULT');
    });

    for (const flag of result.flags) {
        const envFeature = Object.values(context.features || {}).find(f => f.name === flag.name);
        expect(flag.enabled).toBe(envFeature?.enabled);
        expect(flag.value).toBe(envFeature?.value);
    }
});
// CONFIRM hide_disabled_flags is removed in local evaluation
// test('test_environment_get_feature_states_hides_disabled_flags_if_enabled', () => {
//     // One feature is disabled this environment
//     const env = environment();
//     const context = getEvaluationContext(env);
//     const result = getEvaluationResult(context, true);

//     expect(result.flags.length).toBe(1);

//     result.flags.forEach(flag => {
//         expect(flag.reason).toBe('DEFAULT');
//     });

//     for (const flag of result.flags) {
//         const envFeature = Object.values(context.features || {}).find(f => f.name === flag.name);
//         expect(flag.enabled).toBe(envFeature?.enabled);
//         expect(flag.value).toBe(envFeature?.value);
//     }
// });

// Check if this test is still needed
// test('test_environment_get_feature_state', () => {
//     const env = environment();
//     const feature = feature1();
//     const context = getEvaluationContext(env, identity());
//     const featureState = getEnvironmentFeatureStateFromContext(context, feature.name);

//     expect(featureState.name).toStrictEqual(feature.name);
// });

// Check if this test is still needed
// test('test_environment_get_feature_state_raises_feature_state_not_found', () => {
//     const context = getEvaluationContext(environment(), identity());
//     const result = getEvaluationResult(context);
//     expect(() => {
//         getEnvironmentFeatureStateFromContext(context, 'not_a_feature_name');
//     }).toThrowError('Feature State Not Found');
// });
