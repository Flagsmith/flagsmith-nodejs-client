import {
    getEnvironmentFeatureState,
    getEnvironmentFeatureStates,
    getIdentityFeatureState,
    getIdentityFeatureStates
} from '../../../flagsmith-engine';
import { CONSTANTS } from '../../../flagsmith-engine/features/constants';
import { FeatureModel, FeatureStateModel } from '../../../flagsmith-engine/features/models';
import { TraitModel } from '../../../flagsmith-engine/identities/traits/models';
import {
    environment,
    environmentWithSegmentOverride,
    feature1,
    getEnvironmentFeatureStateForFeature,
    getEnvironmentFeatureStateForFeatureByName,
    identity,
    identityInSegment,
    segmentConditionProperty,
    segmentConditionStringValue
} from './utils';

test('test_identity_get_feature_state_without_any_override', () => {
    const feature_state = getIdentityFeatureState(environment(), identity(), feature1().name);

    expect(feature_state.feature).toStrictEqual(feature1());
});

test('test_identity_get_feature_state_without_any_override_no_fs', () => {
    expect(() => {
        getIdentityFeatureState(environment(), identity(), 'nonExistentName');
    }).toThrowError('Feature State Not Found');
});

test('test_identity_get_all_feature_states_no_segments', () => {
    const env = environment();
    const ident = identity();
    const overridden_feature = new FeatureModel(3, 'overridden_feature', CONSTANTS.STANDARD);

    env.featureStates.push(new FeatureStateModel(overridden_feature, false, 3));

    ident.identityFeatures = [new FeatureStateModel(overridden_feature, true, 4)];

    const featureStates = getIdentityFeatureStates(env, ident);

    expect(featureStates.length).toBe(3);
    for (const featuresState of featureStates) {
        const environmentFeatureState = getEnvironmentFeatureStateForFeature(
            env,
            featuresState.feature
        );
        const expected =
            environmentFeatureState?.feature == overridden_feature
                ? true
                : environmentFeatureState?.enabled;
        expect(featuresState.enabled).toBe(expected);
    }
});

test('test_identity_get_all_feature_states_with_traits', () => {
    const trait_models = new TraitModel(segmentConditionProperty, segmentConditionStringValue);

    const featureStates = getIdentityFeatureStates(
        environmentWithSegmentOverride(),
        identityInSegment(),
        [trait_models]
    );
    expect(featureStates[0].getValue()).toBe('segment_override');
});

test('test_identity_get_all_feature_states_with_traits_hideDisabledFlags', () => {
    const trait_models = new TraitModel(segmentConditionProperty, segmentConditionStringValue);

    const env = environmentWithSegmentOverride();
    env.project.hideDisabledFlags = true;

    const featureStates = getIdentityFeatureStates(
        env,
        identityInSegment(),
        [trait_models]
    );
    expect(featureStates.length).toBe(0);
});

test('test_environment_get_all_feature_states', () => {
    const env = environment();
    const featureStates = getEnvironmentFeatureStates(env);

    expect(featureStates).toBe(env.featureStates);
});

test('test_environment_get_feature_states_hides_disabled_flags_if_enabled', () => {
    const env = environment();

    env.project.hideDisabledFlags = true;

    const featureStates = getEnvironmentFeatureStates(env);

    expect(featureStates).not.toBe(env.featureStates);
    for (const fs of featureStates) {
        expect(fs.enabled).toBe(true);
    }
});

test('test_environment_get_feature_state', () => {
    const env = environment();
    const feature = feature1();
    const featureState = getEnvironmentFeatureState(env, feature.name);

    expect(featureState.feature).toStrictEqual(feature);
});

test('test_environment_get_feature_state_raises_feature_state_not_found', () => {
    expect(() => {
        getEnvironmentFeatureState(environment(), 'not_a_feature_name');
    }).toThrowError('Feature State Not Found');
});
