import { EnvironmentModel } from './environments/models';
import { FeatureStateModel } from './features/models';
import { IdentityModel } from './identities/models';
import { TraitModel } from './identities/traits/models';
import { getIdentitySegments } from './segments/evaluators';
import { SegmentModel } from './segments/models';
import { FeatureStateNotFound } from './utils/errors';

function getIdentityFeatureStatesDict(
    environment: EnvironmentModel,
    identity: IdentityModel,
    overrideTraits?: TraitModel[]
) {
    // Get feature states from the environment
    const featureStates: { [key: number]: FeatureStateModel } = {};
    for (const fs of environment.featureStates) {
        featureStates[fs.feature.id] = fs;
    }

    // Override with any feature states defined by matching segments
    const identitySegments: SegmentModel[] = getIdentitySegments(
        environment,
        identity,
        overrideTraits
    );
    for (const matchingSegment of identitySegments) {
        for (const featureState of matchingSegment.featureStates) {
            // note that feature states are stored on the segment in descending priority
            // order so we only care that the last one is added
            // TODO: can we optimise this?
            featureStates[featureState.feature.id] = featureState;
        }
    }

    // Override with any feature states defined directly the identity
    for (const fs of identity.identityFeatures || []) {
        if (featureStates[fs.feature.id]) {
            featureStates[fs.feature.id] = fs;
        }
    }
    return featureStates;
}

export function getIdentityFeatureState(
    environment: EnvironmentModel,
    identity: IdentityModel,
    featureName: string,
    overrideTraits?: TraitModel[]
): FeatureStateModel {
    const featureStates = getIdentityFeatureStatesDict(environment, identity, overrideTraits);

    const matchingFeature = Object.values(featureStates).filter(
        f => f.feature.name === featureName
    );

    if (matchingFeature.length === 0) {
        throw new FeatureStateNotFound('Feature State Not Found');
    }

    return matchingFeature[0];
}

export function getIdentityFeatureStates(
    environment: EnvironmentModel,
    identity: IdentityModel,
    overrideTraits?: TraitModel[]
): FeatureStateModel[] {
    const featureStates = Object.values(
        getIdentityFeatureStatesDict(environment, identity, overrideTraits)
    );

    if (environment.project.hideDisabledFlags) {
        return featureStates.filter(fs => !!fs.enabled);
    }
    return featureStates;
}

export function getEnvironmentFeatureState(environment: EnvironmentModel, featureName: string) {
    const featuresStates = environment.featureStates.filter(f => f.feature.name === featureName);

    if (featuresStates.length === 0) {
        throw new FeatureStateNotFound('Feature State Not Found');
    }

    return featuresStates[0];
}

export function getEnvironmentFeatureStates(environment: EnvironmentModel): FeatureStateModel[] {
    if (environment.project.hideDisabledFlags) {
        return environment.featureStates.filter(fs => !!fs.enabled);
    }
    return environment.featureStates;
}
