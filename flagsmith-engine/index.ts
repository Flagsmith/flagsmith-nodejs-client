import { EnvironmentModel } from './environments/models';
import { FeatureStateModel } from './features/models';
import { IdentityModel } from './identities/models';
import { TraitModel } from './identities/traits/models';
import { getIdentitySegments } from './segments/evaluators';
import { SegmentModel } from './segments/models';

function getIdentityFeatureStatesDict(
    environment: EnvironmentModel,
    identity: IdentityModel,
    override_traits?: TraitModel[]
) {
    // Get feature states from the environment
    const feature_states: { [key: number]: FeatureStateModel } = {};
    for (const fs of environment.featureStates) {
        feature_states[fs.feature.id] = fs;
    }

    // Override with any feature states defined by matching segments
    const identity_segments: SegmentModel[] = getIdentitySegments(
        environment,
        identity,
        override_traits
    );
    for (const matching_segment of identity_segments) {
        for (const feature_state of matching_segment.featureStates) {
            // note that feature states are stored on the segment in descending priority
            // order so we only care that the last one is added
            // TODO: can we optimise this?
            feature_states[feature_state.feature.id] = feature_state;
        }
    }

    // Override with any feature states defined directly the identity
    for (const fs of identity.identityFeatures || []) {
        if (feature_states[fs.feature.id]) {
            feature_states[fs.feature.id] = fs;
        }
    }
    return feature_states;
}

export function getIdentityFeatureState(
    environment: EnvironmentModel,
    identity: IdentityModel,
    feature_name: string,
    override_traits?: TraitModel[]
): FeatureStateModel {
    const featureStates = getIdentityFeatureStatesDict(environment, identity, override_traits);

    const matchingFeature = Object.values(featureStates).filter(
        f => f.feature.name === feature_name
    );

    if (matchingFeature.length === 0) {
        throw new Error('Feature State Not Found');
    }

    return matchingFeature[0];
}

export function getIdentityFeatureStates(
    environment: EnvironmentModel,
    identity: IdentityModel,
    overrideTraits?: TraitModel[]
): FeatureStateModel[] {
    const feature_states = Object.values(
        getIdentityFeatureStatesDict(environment, identity, overrideTraits)
    );

    if (environment.project.hideDisabledFlags) {
        return feature_states.filter(fs => !!fs.enabled);
    }
    return feature_states;
}

export function getEnvironmentFeatureState(environment: EnvironmentModel, featureName: string) {
    const featuresStates = environment.featureStates.filter(f => f.feature.name === featureName);

    if (featuresStates.length === 0) {
        throw new Error('Feature State Not Found');
    }

    return featuresStates[0];
}

export function getEnvironmentFeatureStates(environment: EnvironmentModel): FeatureStateModel[] {
    if (environment.project.hideDisabledFlags) {
        return environment.featureStates.filter(fs => !!fs.enabled);
    }
    return environment.featureStates;
}
