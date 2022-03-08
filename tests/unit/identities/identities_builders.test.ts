import { FeatureStateModel } from '../../../flagsmith-engine/features/models';
import { IdentityModel } from '../../../flagsmith-engine/identities/models';
import { buildIdentityModel } from '../../../flagsmith-engine/identities/util';

test('test_build_identity_model_from_dictionary_no_feature_states', () => {
    const identity = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_traits: [{ trait_key: 'trait_key', trait_value: 'trait_value' }]
    };

    const identityModel = buildIdentityModel(identity);

    expect(identityModel.identityFeatures.length).toBe(0);
    expect(identityModel.identityTraits.length).toBe(1);
});

test('test_build_identity_model_from_dictionary_uses_identity_feature_list_for_identity_features', () => {
    const identity_dict = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_features: [
            {
                id: 1,
                feature: {
                    id: 1,
                    name: 'test_feature',
                    type: 'STANDARD'
                },
                enabled: true,
                feature_state_value: 'some-value'
            }
        ]
    };

    const identityModel = buildIdentityModel(identity_dict);

    expect(identityModel.identityFeatures.length).toBe(1);
});

test('test_build_build_identity_model_from_dict_creates_identity_uuid', () => {
    const identity_model = buildIdentityModel({
        identifier: 'test_user',
        environment_api_key: 'some_key'
    });
    expect(identity_model.identityUuid).not.toBe(undefined);
});

test('test_build_identity_model_from_dictionary_with_feature_states', () => {
    const identity_dict = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_features: [
            {
                id: 1,
                feature: {
                    id: 1,
                    name: 'test_feature',
                    type: 'STANDARD'
                },
                enabled: true,
                feature_state_value: 'some-value'
            }
        ]
    };

    const identityModel = buildIdentityModel(identity_dict);

    expect(identityModel).toBeInstanceOf(IdentityModel);
    expect(identityModel.identityFeatures.length).toBe(1);
    expect(identityModel.identityFeatures[0]).toBeInstanceOf(FeatureStateModel);
});

test('test_identity_dict_created_using_model_can_convert_back_to_model', () => {
    const identityModel = new IdentityModel('some_key', [], [], '', '');

    const identityJSON = JSON.parse(JSON.stringify(identityModel));
    expect(buildIdentityModel(identityJSON)).toBeInstanceOf(IdentityModel);
});
