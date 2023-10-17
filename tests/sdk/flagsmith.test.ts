import Flagsmith from '../../sdk';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager';
import fetch, {RequestInit} from 'node-fetch';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, identitiesJSON } from './utils';
import { DefaultFlag, Flags } from '../../sdk/models';
import {delay, retryFetch} from '../../sdk/utils';
import * as utils from '../../sdk/utils';
import { EnvironmentModel } from '../../flagsmith-engine/environments/models';
import https from 'https'
import { BaseOfflineHandler } from '../../sdk/offline_handlers';

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

    const model = environmentModel(JSON.parse(environmentJSON()));

    wipeFeatureStateUUIDs(flg.environment)
    wipeFeatureStateUUIDs(model)

    expect(flg.environment).toStrictEqual(model);
});

test('test_set_agent_options', async () => {
    const agent = new https.Agent({})

    // @ts-ignore
    fetch.mockImplementation((url:string, options:RequestInit)=>{
        if(options.agent!==agent) {
            throw new Error("Agent has not been set on retry fetch")
        }
        return Promise.resolve(new Response(environmentJSON()))
    });

    const flg = flagsmith({
        agent
    });

    await flg.updateEnvironment();
    expect(flg.environment).toBeDefined();

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

test('test_update_environment_uses_req_when_inited', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));
    const identifier = 'identifier';

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

test('default flag handler used when timeout occurs', async () => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(sleep(10000)));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        requestTimeoutSeconds: 0.001,
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
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response('bad data')));


    const flg = new Flagsmith({
        environmentKey: 'key',
    });

    expect(async () => {
        await flg.getIdentityFlags('identifier');
    }).rejects.toThrow();

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

test('getIdentityFlags throws error if identifier is empty string', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key',
    });

    await expect(flagsmith.getIdentityFlags('')).rejects.toThrow('`identifier` argument is missing or invalid.');
})


test('getIdentitySegments throws error if identifier is empty string', () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key',
    });

    expect(() => { flagsmith.getIdentitySegments(''); }).toThrow('`identifier` argument is missing or invalid.');
})


test('offline_mode', async() => {
    // Given
    const environment: EnvironmentModel = environmentModel(JSON.parse(environmentJSON('offline-environment.json')));

    class DummyOfflineHandler extends BaseOfflineHandler {
        getEnvironment(): EnvironmentModel {
            return environment;
        }
    }

    // When
    const flagsmith = new Flagsmith({ offlineMode: true, offlineHandler: new DummyOfflineHandler() });

    // Then
    // we can request the flags from the client successfully
    const environmentFlags: Flags = await flagsmith.getEnvironmentFlags();
    let flag = environmentFlags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('offline-value');


    const identityFlags: Flags = await flagsmith.getIdentityFlags("identity");
    flag = identityFlags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('offline-value');
});


test('test_flagsmith_uses_offline_handler_if_set_and_no_api_response', async () => {
    // Given
    const environment: EnvironmentModel = environmentModel(JSON.parse(environmentJSON('offline-environment.json')));
    const api_url = 'http://some.flagsmith.com/api/v1/';
    const mock_offline_handler = new BaseOfflineHandler() as jest.Mocked<BaseOfflineHandler>;
  
    jest.spyOn(mock_offline_handler, 'getEnvironment').mockReturnValue(environment);

    const flagsmith = new Flagsmith({
      environmentKey: 'some-key',
      apiUrl: api_url,
      offlineHandler: mock_offline_handler,
    });

    jest.spyOn(flagsmith, 'getEnvironmentFlags');
    jest.spyOn(flagsmith, 'getIdentityFlags');

  
    flagsmith.environmentFlagsUrl = 'http://some.flagsmith.com/api/v1/environment-flags';
    flagsmith.identitiesUrl = 'http://some.flagsmith.com/api/v1/identities';

    // Mock a 500 Internal Server Error response
    const errorResponse = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
    });

    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(errorResponse));

    // When
    await flagsmith.getEnvironmentFlags();
    await flagsmith.getIdentityFlags('identity', {});

    // Then
    expect(mock_offline_handler.getEnvironment).toHaveBeenCalledTimes(1);
    expect(flagsmith.getEnvironmentFlags).toHaveBeenCalled();
    expect(flagsmith.getIdentityFlags).toHaveBeenCalled();
  
    const environmentFlags:Flags = await flagsmith.getEnvironmentFlags();
    const identityFlags:Flags = await flagsmith.getIdentityFlags('identity', {});
  
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
    expect(() => new Flagsmith({
      offlineHandler: new BaseOfflineHandler(),
      defaultFlagHandler: (flagName) => new DefaultFlag('foo', true)
    })).toThrowError('ValueError: Cannot use both defaultFlagHandler and offlineHandler.');
});
  
test('cannot create Flagsmith client in remote evaluation without API key', () => {
    // When and Then
    // @ts-ignore
    expect(() => new Flagsmith()).toThrowError('ValueError: environmentKey is required.');
});


async function wipeFeatureStateUUIDs (environmentModel: EnvironmentModel) {
    // TODO: this has been pulled out of tests above as a helper function.
    //  I'm not entirely sure why it's necessary, however, we should look to remove.
    environmentModel.featureStates.forEach(fs => {
        // @ts-ignore
        fs.featurestateUUID = undefined;
        fs.multivariateFeatureStateValues.forEach(mvfsv => {
            // @ts-ignore
            mvfsv.mvFsValueUuid = undefined;
        })
    });
    environmentModel.project.segments.forEach(s => {
        s.featureStates.forEach(fs => {
            // @ts-ignore
            fs.featurestateUUID = undefined;
        })
    })
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
