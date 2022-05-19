import Flagsmith from '../../sdk';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager';
import fetch, { Headers } from 'node-fetch';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, identitiesJSON } from './utils';
import { DefaultFlag } from '../../sdk/models';

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
    new Flagsmith({
        environmentKey: 'bad.key',
        enableLocalEvaluation: true
    });
    expect(EnvironmentDataPollingManager).toBeCalled();
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
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
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
