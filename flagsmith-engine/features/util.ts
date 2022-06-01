import {
    FeatureModel,
    FeatureSegment,
    FeatureStateModel,
    MultivariateFeatureOptionModel,
    MultivariateFeatureStateValueModel
} from './models';

export function buildFeatureModel(featuresModelJSON: any): FeatureModel {
    return new FeatureModel(featuresModelJSON.id, featuresModelJSON.name, featuresModelJSON.type);
}

export function buildFeatureStateModel(featuresStateModelJSON: any): FeatureStateModel {
    const featureStateModel = new FeatureStateModel(
        buildFeatureModel(featuresStateModelJSON.feature),
        featuresStateModelJSON.enabled,
        featuresStateModelJSON.django_id,
        featuresStateModelJSON.feature_state_value,
        featuresStateModelJSON.uuid
    );

    featureStateModel.featureSegment = featuresStateModelJSON.feature_segment ? 
        buildFeatureSegment(featuresStateModelJSON.feature_segment) : 
        undefined;

    const multivariateFeatureStateValues = featuresStateModelJSON.multivariate_feature_state_values
        ? featuresStateModelJSON.multivariate_feature_state_values.map((fsv: any) => {
              const featureOption = new MultivariateFeatureOptionModel(
                  fsv.multivariate_feature_option.value,
                  fsv.multivariate_feature_option.id
              );
              return new MultivariateFeatureStateValueModel(
                  featureOption,
                  fsv.percentage_allocation,
                  fsv.id
              );
          })
        : [];

    featureStateModel.multivariateFeatureStateValues = multivariateFeatureStateValues;

    return featureStateModel;
}

export function buildFeatureSegment(featureSegmentJSON: any): FeatureSegment {
    return new FeatureSegment(featureSegmentJSON.priority);
}
