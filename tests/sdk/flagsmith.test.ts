import Flagsmith from '../../sdk/index.js';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager.js';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, fetch, offlineEnvironmentJSON } from './utils.js';
import { DefaultFlag, Flags } from '../../sdk/models.js';
import { delay } from '../../sdk/utils.js';
import { EnvironmentModel } from '../../flagsmith-engine/environments/models.js';
import { BaseOfflineHandler } from '../../sdk/offline_handlers.js';
import { Agent } from 'undici';

vi.mock('../../sdk/polling_manager');
beforeEach(() => {
    vi.clearAllMocks();
});

test('test_flagsmith_starts_polling_manager_on_init_if_enabled', () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    expect(EnvironmentDataPollingManager).toBeCalled();
});

test('test_flagsmith_local_evaluation_key_required', () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    console.error = vi.fn();
    new Flagsmith({
        environmentKey: 'bad.key',
        enableLocalEvaluation: true
    });
    expect(console.error).toBeCalled();
});

test('test_update_environment_sets_environment', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    const flg = flagsmith();
    await flg.updateEnvironment();
    expect(flg.environment).toBeDefined();

    const model = environmentModel(JSON.parse(environmentJSON));

    expect(flg.environment).toStrictEqual(model);
});

test('test_set_agent_options', async () => {
    const agent = new Agent({})

    fetch.mockImplementation((url, options) => {
        //@ts-ignore I give up
        if (options.dispatcher !== agent) {
            throw new Error("Agent has not been set on retry fetch")
        }
        return Promise.resolve(new Response(environmentJSON))
    });

    const flg = flagsmith({
        agent
    });

    await flg.updateEnvironment();
    expect(flg.environment).toBeDefined();
});

test('test_get_identity_segments', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    const segments = await flg.getIdentitySegments('user', { age: 21 });
    expect(segments[0].name).toEqual('regular_segment');
    const segments2 = await flg.getIdentitySegments('user', { age: 41 });
    expect(segments2.length).toEqual(0);
});


test('test_get_identity_segments_empty_without_local_eval', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: false
    });
    const segments = await flg.getIdentitySegments('user', { age: 21 });
    expect(segments.length).toBe(0);
});

test('test_update_environment_uses_req_when_inited', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));

    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
    });

    delay(400);

    expect(async () => {
        await flg.updateEnvironment();
    }).not.toThrow();
});

test('test_isFeatureEnabled_environment', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
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
        .mockRejectedValue('Error during fetching the API response')
        .mockResolvedValue(new Response(flagsJSON));
    const flg = flagsmith({
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

test('default flag handler used when timeout occurs', async () => {
    fetch.mockImplementation(async (...args) => {
        await sleep(10000)
        return fetch(...args)
    });

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        requestTimeoutSeconds: 0.0001,
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
})

test('request timeout uses default if not provided', async () => {

    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    expect(flg.requestTimeoutMs).toBe(10000);
})

test('test_throws_when_no_identityFlags_returned_due_to_error', async () => {
    fetch.mockResolvedValue(new Response('bad data'));

    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    await expect(async () => await flg.getIdentityFlags('identifier'))
        .rejects
        .toThrow();
});

test('test onEnvironmentChange is called when provided', async () => {
    const callback = {
        callback: (e: Error | null, result: EnvironmentModel) => { }
    };
    const callbackSpy = vi.spyOn(callback, 'callback');

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback.callback,
    });

    await delay(200);

    expect(callbackSpy).toBeCalled();
});

test('test onEnvironmentChange is called after error', async () => {
    const callback = vi.fn((e, result) => {})

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback,
    });

    await delay(200);

    expect(callback).toBeCalled();
});

test('getIdentityFlags throws error if identifier is empty string', async () => {
    const flg = flagsmith({
        environmentKey: 'key',
    });

    await expect(flg.getIdentityFlags('')).rejects.toThrow('`identifier` argument is missing or invalid.');
})


test('getIdentitySegments throws error if identifier is empty string', () => {
    const flg = flagsmith({
        environmentKey: 'key',
    });

    expect(() => { flg.getIdentitySegments(''); }).toThrow('`identifier` argument is missing or invalid.');
})


test('offline_mode', async () => {
    // Given
    const environment: EnvironmentModel = environmentModel(JSON.parse(offlineEnvironmentJSON));

    class DummyOfflineHandler extends BaseOfflineHandler {
        getEnvironment(): EnvironmentModel {
            return environment;
        }
    }

    // When
    const flg = flagsmith({ offlineMode: true, offlineHandler: new DummyOfflineHandler() });

    // Then
    // we can request the flags from the client successfully
    const environmentFlags: Flags = await flg.getEnvironmentFlags();
    let flag = environmentFlags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('offline-value');


    const identityFlags: Flags = await flg.getIdentityFlags("identity");
    flag = identityFlags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('offline-value');
});


test('test_flagsmith_uses_offline_handler_if_set_and_no_api_response', async () => {
    // Given
    const environment: EnvironmentModel = environmentModel(JSON.parse(offlineEnvironmentJSON));
    const api_url = 'http://some.flagsmith.com/api/v1/';
    const mock_offline_handler = new BaseOfflineHandler();

    vi.spyOn(mock_offline_handler, 'getEnvironment').mockReturnValue(environment);

    const flg = flagsmith({
        environmentKey: 'some-key',
        apiUrl: api_url,
        offlineHandler: mock_offline_handler,
    });

    vi.spyOn(flg, 'getEnvironmentFlags');
    vi.spyOn(flg, 'getIdentityFlags');


    flg.environmentFlagsUrl = 'http://some.flagsmith.com/api/v1/environment-flags';
    flg.identitiesUrl = 'http://some.flagsmith.com/api/v1/identities';

    // Mock a 500 Internal Server Error response
    const errorResponse = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
    });

    fetch.mockResolvedValue(errorResponse);

    // When
    const environmentFlags: Flags = await flg.getEnvironmentFlags();
    const identityFlags: Flags = await flg.getIdentityFlags('identity', {});

    // Then
    expect(mock_offline_handler.getEnvironment).toHaveBeenCalledTimes(1);
    expect(flg.getEnvironmentFlags).toHaveBeenCalled();
    expect(flg.getIdentityFlags).toHaveBeenCalled();

    expect(environmentFlags.isFeatureEnabled('some_feature')).toBe(true);
    expect(environmentFlags.getFeatureValue('some_feature')).toBe('offline-value');

    expect(identityFlags.isFeatureEnabled('some_feature')).toBe(true);
    expect(identityFlags.getFeatureValue('some_feature')).toBe('offline-value');
});

test('cannot use offline mode without offline handler', () => {
    // When and Then
    expect(() => new Flagsmith({ offlineMode: true, offlineHandler: undefined })).toThrowError(
        'ValueError: offlineHandler must be provided to use offline mode.'
    );
});

test('cannot use both default handler and offline handler', () => {
    // When and Then
    expect(() => flagsmith({
        offlineHandler: new BaseOfflineHandler(),
        defaultFlagHandler: () => new DefaultFlag('foo', true)
    })).toThrowError('ValueError: Cannot use both defaultFlagHandler and offlineHandler.');
});

test('cannot create Flagsmith client in remote evaluation without API key', () => {
    // When and Then
    expect(() => new Flagsmith()).toThrowError('ValueError: environmentKey is required.');
});


function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
test('test_localEvaluation_true__identity_overrides_evaluated', async () => {
    fetch.mockResolvedValue(new Response(environmentJSON));
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
    });

    const flags = await flg.getIdentityFlags("overridden-id");
    expect(flags.getFeatureValue("some_feature")).toEqual("some-overridden-value");
});
