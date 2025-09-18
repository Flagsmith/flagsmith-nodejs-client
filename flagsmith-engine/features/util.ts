import {
    FeatureModel,
    FeatureSegment,
    FeatureStateModel,
    MultivariateFeatureOptionModel,
    MultivariateFeatureStateValueModel
} from './models.js';

import { FeatureContext } from '../evaluationContext/models.js';
import { getHashedPercentageForObjIds as getHashedPercentageForObjIds } from '../utils/hashing/index.js';

export function buildFeatureModel(featuresModelJSON: any): FeatureModel {
    return new FeatureModel(featuresModelJSON.id, featuresModelJSON.name, featuresModelJSON.type);
}

export function buildFeatureStateModel(featuresStateModelJSON: any): FeatureStateModel {
    const featureStateModel = new FeatureStateModel(
        buildFeatureModel(featuresStateModelJSON.feature),
        featuresStateModelJSON.enabled,
        featuresStateModelJSON.django_id,
        featuresStateModelJSON.feature_state_value,
        featuresStateModelJSON.featurestate_uuid
    );

    featureStateModel.featureSegment = featuresStateModelJSON.feature_segment
        ? buildFeatureSegment(featuresStateModelJSON.feature_segment)
        : undefined;

    const multivariateFeatureStateValues = featuresStateModelJSON.multivariate_feature_state_values
        ? featuresStateModelJSON.multivariate_feature_state_values.map((fsv: any) => {
              const featureOption = new MultivariateFeatureOptionModel(
                  fsv.multivariate_feature_option.value,
                  fsv.multivariate_feature_option.id
              );
              return new MultivariateFeatureStateValueModel(
                  featureOption,
                  fsv.percentage_allocation,
                  fsv.id,
                  fsv.mv_fs_value_uuid
              );
          })
        : [];

    featureStateModel.multivariateFeatureStateValues = multivariateFeatureStateValues;

    return featureStateModel;
}

export function buildFeatureSegment(featureSegmentJSON: any): FeatureSegment {
    return new FeatureSegment(featureSegmentJSON.priority);
}

export function evaluateFeatureValue(feature: FeatureContext, identityKey?: string): any {
    if (!!feature.variants && feature.variants.length > 0 && !!identityKey) {
        return evaluateMultivariateFeature(feature, identityKey);
    }

    return feature.value;
}

function evaluateMultivariateFeature(feature: FeatureContext, identityKey?: string): any {
    const percentageValue = getHashedPercentageForObjIds([feature.key, identityKey]);

    let startPercentage = 0;
    for (const variant of feature?.variants || []) {
        const limit = startPercentage + variant.weight;

        if (startPercentage <= percentageValue && percentageValue < limit) {
            return variant.value;
        }
        startPercentage = limit;
    }
    return feature.value;
}
