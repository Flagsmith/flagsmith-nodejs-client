import Flagsmith from '../../sdk';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager';
import fetch from 'node-fetch';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, identitiesJSON } from './utils';
import { DefaultFlag } from '../../sdk/models';
import { delay } from '../../sdk/utils';
import { EnvironmentModel } from '../../flagsmith-engine/environments/models';

jest.mock('node-fetch');
jest.mock('../../sdk/polling_manager');
const { Response } = jest.requireActual('node-fetch');

beforeEach(() => {
    // @ts-ignore
    jest.clearAllMocks();
});

test('test_flagsmith_starts_polling_manager_on_init_if_enabled', () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    expect(EnvironmentDataPollingManager).toBeCalled();
});

test('test_flagsmith_local_evaluation_key_required', () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    console.error = jest.fn();
    new Flagsmith({
        environmentKey: 'bad.key',
        enableLocalEvaluation: true
    });
    expect(console.error).toBeCalled();
});

test('test_update_environment_sets_environment', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    const flg = flagsmith();
    await flg.updateEnvironment();
    expect(flg.environment).toBeDefined();

    // @ts-ignore
    flg.environment.featureStates[0].featurestateUUID = undefined;
    // @ts-ignore
    flg.environment.project.segments[0].featureStates[0].featurestateUUID = undefined;
    // @ts-ignore
    const model = environmentModel(JSON.parse(environmentJSON()));
    // @ts-ignore
    model.featureStates[0].featurestateUUID = undefined;
    // @ts-ignore
    model.project.segments[0].featureStates[0].featurestateUUID = undefined;
    expect(flg.environment).toStrictEqual(model);
});

test('test_get_identity_segments', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    const segments = await flg.getIdentitySegments('user', { age: 21 });
    expect(segments[0].name).toEqual('regular_segment');
    const segments2 = await flg.getIdentitySegments('user', { age: 41 });
    expect(segments2.length).toEqual(0);
});


test('test_get_identity_segments_empty_without_local_eval', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: false
    });
    const segments = await flg.getIdentitySegments('user', { age: 21 });
    expect(segments.length).toBe(0);
});

test('test_get_environment_flags_calls_api_when_no_local_environment', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const flg = flagsmith();
    const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

    expect(fetch).toBeCalledTimes(1);
    expect(allFlags[0].enabled).toBe(true);
    expect(allFlags[0].value).toBe('some-value');
    expect(allFlags[0].featureName).toBe('some_feature');
});
test('test_get_environment_flags_uses_local_environment_when_available', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const flg = flagsmith();
    const model = environmentModel(JSON.parse(environmentJSON()));
    flg.environment = model;

    const allFlags = await (await flg.getEnvironmentFlags()).allFlags();
    expect(fetch).toBeCalledTimes(0);
    expect(allFlags[0].enabled).toBe(model.featureStates[0].enabled);
    expect(allFlags[0].value).toBe(model.featureStates[0].getValue());
    expect(allFlags[0].featureName).toBe(model.featureStates[0].feature.name);
});
test('test_get_identity_flags_calls_api_when_no_local_environment_no_traits', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(identitiesJSON())));
    const identifier = 'identifier';

    const flg = flagsmith();

    const identityFlags = (await flg.getIdentityFlags(identifier)).allFlags();

    expect(identityFlags[0].enabled).toBe(true);
    expect(identityFlags[0].value).toBe('some-value');
    expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_get_identity_flags_calls_api_when_local_environment_no_traits', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    const identifier = 'identifier';

    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,

    });


    const identityFlags = (await flg.getIdentityFlags(identifier)).allFlags();

    expect(identityFlags[0].enabled).toBe(true);
    expect(identityFlags[0].value).toBe('some-value');
    expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_get_identity_flags_calls_api_when_no_local_environment_with_traits', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(identitiesJSON())));
    const identifier = 'identifier';
    const traits = { some_trait: 'some_value' };
    const flg = flagsmith();

    const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();

    expect(identityFlags[0].enabled).toBe(true);
    expect(identityFlags[0].value).toBe('some-value');
    expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_default_flag_is_used_when_no_environment_flags_returned', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify([]))));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        customHeaders: {
            'X-Test-Header': '1',
        }
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
});

test('test_analytics_processor_tracks_flags', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true,
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('some-value');
});

test('test_getFeatureValue', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true,
    });

    const flags = await flg.getEnvironmentFlags();
    const featureValue = flags.getFeatureValue('some_feature');

    expect(featureValue).toBe('some-value');
});

test('test_isFeatureEnabled', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true,
    });

    const flags = await flg.getEnvironmentFlags();
    const featureValue = flags.isFeatureEnabled('some_feature');

    expect(featureValue).toBe(true);
});

test('test_fetch_recovers_after_single_API_error', async () => {
    fetch
        // @ts-ignore
        .mockRejectedValueOnce(new Error('Error during fetching the API response'))
        .mockReturnValue(Promise.resolve(new Response(flagsJSON())));
    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('some-value');
});

test('test_default_flag_used_after_multiple_API_errors', async () => {
    fetch
        // @ts-ignore
        .mockRejectedValue(new Error('Error during fetching the API response'));
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
});

test('test_throws_when_no_default_flag_handler_after_multiple_API_errors', async () => {
    fetch
        // @ts-ignore
        .mockRejectedValue(new Error('Error during fetching the API response'));

    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    await expect(async () => {
        const flags = await flg.getEnvironmentFlags();
        const flag = flags.getFlag('some_feature');
    }).rejects.toThrow('Error during fetching the API response');
});

test('test_non_200_response_raises_flagsmith_api_error', async () => {
    const errorResponse403 = new Response('403 Forbidden', {
        status: 403
    });
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(errorResponse403));

    const flg = new Flagsmith({
        environmentKey: 'some'
    });

    await expect(flg.getEnvironmentFlags()).rejects.toThrow();
});
test('test_default_flag_is_not_used_when_environment_flags_returned', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.value).not.toBe(defaultFlag.value);
    expect(flag.value).toBe('some-value');
});

test('test_default_flag_is_used_when_bad_api_response_happens', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response('bad-data')));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(true);
    expect(flag.value).toBe(defaultFlag.value);
});

test('test_local_evaluation', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        defaultFlagHandler: defaultFlagHandler
    });

    await delay(200);

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.value).not.toBe(defaultFlag.value);
    expect(flag.value).toBe('some-value');
});

test('test_default_flag_is_not_used_when_identity_flags_returned', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(identitiesJSON())));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getIdentityFlags('identifier');
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.value).not.toBe(defaultFlag.value);
    expect(flag.value).toBe('some-value');
});

test('test_default_flag_is_used_when_no_identity_flags_returned', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ flags: [], traits: [] }))));

    const defaultFlag = new DefaultFlag('some-default-value', true);
    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getIdentityFlags('identifier');
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(true);
    expect(flag.value).toBe(defaultFlag.value);
    expect(flag.enabled).toBe(defaultFlag.enabled);
});

test('test_default_flag_is_used_when_no_identity_flags_returned_and_no_custom_default_flag_handler', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ flags: [], traits: [] }))));


    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    const flags = await flg.getIdentityFlags('identifier');
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(true);
    expect(flag.value).toBe(undefined);
    expect(flag.enabled).toBe(false);
});

test('test onEnvironmentChange is called when provided', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));

    const callback = {
        callback: (e: Error | null, result: EnvironmentModel) => { }
    };
    const callbackSpy = jest.spyOn(callback, 'callback');

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback.callback,
    });

    await delay(200);

    expect(callbackSpy).toBeCalled();
});

test('test onEnvironmentChange is called after error', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response('aaa')));

    const callback = {
        callback: (e: Error | null, result: EnvironmentModel) => { }
    };
    const callbackSpy = jest.spyOn(callback, 'callback');

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback.callback,
    });

    await delay(200);

    expect(callbackSpy).toBeCalled();
});