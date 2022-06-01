import { EnvironmentModel } from '../../../../flagsmith-engine/environments/models';
import {
    buildEnvironmentAPIKeyModel,
    buildEnvironmentModel
} from '../../../../flagsmith-engine/environments/util';
import { CONSTANTS } from '../../../../flagsmith-engine/features/constants';
import {
    FeatureStateModel,
    MultivariateFeatureStateValueModel
} from '../../../../flagsmith-engine/features/models';
import { getEnvironmentFeatureStateForFeatureByName } from '../utils';

test('test_get_flags_for_environment_returns_feature_states_for_environment_dictionary', () => {
    const stringValue = 'foo';
    const featureWithStringValueName = 'feature_with_string_value';

    const environmentDict = {
        id: 1,
        api_key: 'api-key',
        project: {
            id: 1,
            name: 'test project',
            organisation: {
                id: 1,
                name: 'Test Org',
                stop_serving_flags: false,
                persist_trait_data: true,
                feature_analytics: true
            },
            hide_disabled_flags: false
        },
        feature_states: [
            {
                id: 1,
                enabled: true,
                feature_state_value: undefined,
                feature: { id: 1, name: 'enabled_feature', type: CONSTANTS.STANDARD }
            },
            {
                id: 2,
                enabled: false,
                feature_state_value: undefined,
                feature: { id: 2, name: 'disabled_feature', type: CONSTANTS.STANDARD }
            },
            {
                id: 3,
                enabled: true,
                feature_state_value: stringValue,
                feature: {
                    id: 3,
                    name: featureWithStringValueName,
                    type: CONSTANTS.STANDARD
                }
            }
        ]
    };

    const environmentModel = buildEnvironmentModel(environmentDict);

    expect(environmentModel).toBeInstanceOf(EnvironmentModel);
    expect(environmentModel.featureStates.length).toBe(3);
    for (const fs of environmentModel.featureStates) {
        expect(fs).toBeInstanceOf(FeatureStateModel);
    }
    const receivedValue = getEnvironmentFeatureStateForFeatureByName(
        environmentModel,
        featureWithStringValueName
    )?.getValue();
    expect(receivedValue).toBe(stringValue);
});

test('test_build_environment_model_with_multivariate_flag', () => {
    const variate1Value = 'value-1';
    const variate2Value = 'value-2';

    const environmentJSON = {
        id: 1,
        api_key: 'api-key',
        project: {
            id: 1,
            name: 'test project',
            organisation: {
                id: 1,
                name: 'Test Org',
                stop_serving_flags: false,
                persist_trait_data: true,
                feature_analytics: true
            },
            hide_disabled_flags: false
        },
        feature_states: [
            {
                id: 1,
                enabled: true,
                feature_state_value: undefined,
                feature: {
                    id: 1,
                    name: 'enabled_feature',
                    type: CONSTANTS.STANDARD
                },
                multivariate_feature_state_values: [
                    {
                        id: 1,
                        percentage_allocation: 10.0,
                        multivariate_feature_option: {
                            value: variate1Value
                        }
                    },
                    {
                        id: 2,
                        percentage_allocation: 10.0,
                        multivariate_feature_option: {
                            value: variate2Value,
                            id: 2
                        }
                    }
                ]
            }
        ]
    };

    const environmentModel = buildEnvironmentModel(environmentJSON);

    expect(environmentModel).toBeInstanceOf(EnvironmentModel);
    expect(environmentJSON.feature_states.length).toBe(1);

    const fs = environmentModel.featureStates[0];

    for (const mvfs of fs.multivariateFeatureStateValues) {
        expect(mvfs).toBeInstanceOf(MultivariateFeatureStateValueModel);
    }
});

test('test_build_environment_api_key_model', () => {
    const environmentKeyJSON = {
        key: 'ser.7duQYrsasJXqdGsdaagyfU',
        active: true,
        created_at: '2022-02-07T04:58:25.969438+00:00',
        client_api_key: 'RQchaCQ2mYicSCAwKoAg2E',
        id: 10,
        name: 'api key 2',
        expires_at: undefined
    };

    const environmentAPIKeyModel = buildEnvironmentAPIKeyModel(environmentKeyJSON);

    expect(environmentAPIKeyModel.key).toBe(environmentKeyJSON['key']);
});
