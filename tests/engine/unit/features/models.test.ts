import { CONSTANTS } from '../../../../flagsmith-engine/features/constants';
import {
    FeatureModel,
    FeatureStateModel,
    MultivariateFeatureOptionModel,
    MultivariateFeatureStateValueModel
} from '../../../../flagsmith-engine/features/models';
import { feature1 } from '../utils';

test('test_compare_feature_model', () => {
    const fm1 = new FeatureModel(1, 'a', 'test');
    const fm2 = new FeatureModel(1, 'a', 'test');
    expect(fm1.eq(fm2)).toBe(true);
});

test('test_initializing_feature_state_creates_default_feature_state_uuid', () => {
    const featureState = new FeatureStateModel(feature1(), true, 1);
    expect(featureState.featurestateUUID).toBeDefined();
});

test('test_initializing_multivariate_feature_state_value_creates_default_uuid', () => {
    const mvFeatureOption = new MultivariateFeatureOptionModel('value');
    const mvFsValueModel = new MultivariateFeatureStateValueModel(mvFeatureOption, 10, 1);

    expect(mvFsValueModel.mvFsValueUuid).toBeDefined();
});

test('test_feature_state_get_value_no_mv_values', () => {
    const value = 'foo';
    const featureState = new FeatureStateModel(feature1(), true, 1);

    featureState.setValue(value);

    expect(featureState.getValue()).toBe(value);
    expect(featureState.getValue(1)).toBe(value);
});

test('test_feature_state_get_value_mv_values', () => {
    const mvFeatureControlValue = 'control';
    const mvFeatureValue1 = 'foo';
    const mvFeatureValue2 = 'bar';

    const cases = [
        [10, mvFeatureValue1],
        [40, mvFeatureValue2],
        [70, mvFeatureControlValue]
    ];

    for (const testCase of cases) {
        const myFeature = new FeatureModel(1, 'mv_feature', CONSTANTS.STANDARD);

        const mvFeatureOption1 = new MultivariateFeatureOptionModel(mvFeatureValue1, 1);
        const mvFeatureOption2 = new MultivariateFeatureOptionModel(mvFeatureValue2, 2);

        const mvFeatureStateValue1 = new MultivariateFeatureStateValueModel(
            mvFeatureOption1,
            30,
            1
        );
        const mvFeatureStateValue2 = new MultivariateFeatureStateValueModel(
            mvFeatureOption2,
            30,
            2
        );

        const mvFeatureState = new FeatureStateModel(myFeature, true, 1);
        mvFeatureState.multivariateFeatureStateValues = [
            mvFeatureStateValue1,
            mvFeatureStateValue2
        ];

        mvFeatureState.setValue(mvFeatureControlValue);

        expect(mvFeatureState.getValue('test')).toBe(mvFeatureValue2);
    }
});
