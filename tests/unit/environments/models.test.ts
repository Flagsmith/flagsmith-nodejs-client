import { EnvironmentAPIKeyModel } from '../../../flagsmith-engine/environments/models';

test('test_environment_api_key_model_is_valid_is_true_for_non_expired_active_key', () => {
    const environmentAPIKeyModel = new EnvironmentAPIKeyModel(
        1,
        'ser.random_key',
        Date.now(),
        'test_key',
        'test_key'
    );
    expect(environmentAPIKeyModel.isValid()).toBe(true);
});

test('test_environment_api_key_model_is_valid_is_true_for_non_expired_active_key_with_expired_date_in_future', () => {
    const environmentAPIKeyModel = new EnvironmentAPIKeyModel(
        1,
        'ser.random_key',
        Date.now(),
        'test_key',
        'test_key',
        Date.now() + 1000 * 60 * 60 * 24 * 2
    );
    expect(environmentAPIKeyModel.isValid()).toBe(true);
});

test('test_environment_api_key_model_is_valid_is_false_for_expired_active_key', () => {
    const environmentAPIKeyModel = new EnvironmentAPIKeyModel(
        1,
        'ser.random_key',
        Date.now() - 1000 * 60 * 60 * 24 * 2,
        'test_key',
        'test_key',
        Date.now()
    );
    expect(environmentAPIKeyModel.isValid()).toBe(false);
});

test('test_environment_api_key_model_is_valid_is_false_for_non_expired_inactive_key', () => {
    const environmentAPIKeyModel = new EnvironmentAPIKeyModel(
        1,
        'ser.random_key',
        Date.now(),
        'test_key',
        'test_key'
    );

    environmentAPIKeyModel.active = false;
    expect(environmentAPIKeyModel.isValid()).toBe(false);
});
