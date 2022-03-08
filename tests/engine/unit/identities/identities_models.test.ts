import { FeatureStateModel } from '../../../../flagsmith-engine/features/models';
import { IdentityModel } from '../../../../flagsmith-engine/identities/models';
import { TraitModel } from '../../../../flagsmith-engine/identities/traits/models';
import { buildIdentityModel } from '../../../../flagsmith-engine/identities/util';
import { feature1, identityInSegment } from '../utils';

test('test_composite_key', () => {
    const identity = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_traits: [{ trait_key: 'trait_key', trait_value: 'trait_value' }]
    };

    const identityModel = buildIdentityModel(identity);

    expect(identityModel.compositeKey).toBe('api-key_test-identity');
});

test('test_identiy_model_creates_default_identity_uuid', () => {
    const identity = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_traits: [{ trait_key: 'trait_key', trait_value: 'trait_value' }]
    };

    const identityModel = buildIdentityModel(identity);

    expect(identityModel.identityUuid).toBeDefined();
});

test('test_generate_composite_key', () => {
    const identity = {
        id: 1,
        identifier: 'test-identity',
        environment_api_key: 'api-key',
        created_date: '2021-08-22T06:25:23.406995Z',
        identity_traits: [{ trait_key: 'trait_key', trait_value: 'trait_value' }]
    };

    const identityModel = buildIdentityModel(identity);

    expect(IdentityModel.generateCompositeKey('api-key', 'test-identity')).toBe(
        'api-key_test-identity'
    );
});

test('test_update_traits_remove_traits_with_none_value', () => {
    const ident = identityInSegment();

    const trait_key = ident.identityTraits[0].traitKey;
    const trait_to_remove = new TraitModel(trait_key, undefined);

    ident.update_traits([trait_to_remove]);

    expect(ident.identityTraits.length).toBe(0);
});

test('test_update_identity_traits_updates_trait_value', () => {
    const identity = identityInSegment();

    const traitKey = identity.identityTraits[0].traitKey;
    const traitValue = 'updated_trait_value';
    const traitToUpdate = new TraitModel(traitKey, traitValue);

    identity.update_traits([traitToUpdate]);

    expect(identity.identityTraits.length).toBe(1);
    expect(identity.identityTraits[0]).toBe(traitToUpdate);
});

test('test_update_traits_adds_new_traits', () => {
    const identity = identityInSegment();

    const newTrait = new TraitModel('new_key', 'foobar');

    identity.update_traits([newTrait]);

    expect(identity.identityTraits.length).toBe(2);
    expect(identity.identityTraits).toContain(newTrait);
});

test('test_append_feature_state', () => {
    const ident = identityInSegment();

    const fs1 = new FeatureStateModel(feature1(), false, 1);

    ident.identityFeatures.push(fs1);

    expect(ident.identityFeatures).toContain(fs1);
});

test('test_appending_feature_states_raises_duplicate_feature_state_if_fs_for_the_feature_already_exists', () => {
    const ident = identityInSegment();

    const fs1 = new FeatureStateModel(feature1(), false, 1);
    const fs2 = new FeatureStateModel(feature1(), true, 1);
    ident.identityFeatures.push(fs1);
    expect(() => {
        ident.identityFeatures.push(fs2);
    }).toThrowError();
});
