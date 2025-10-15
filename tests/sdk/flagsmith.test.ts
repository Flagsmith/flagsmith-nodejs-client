import Flagsmith from '../../sdk/index.js';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager.js';
import {
    environmentJSON,
    environmentModel,
    flagsmith,
    fetch,
    offlineEnvironmentJSON,
    badFetch
} from './utils.js';
import { DefaultFlag, Flags } from '../../sdk/models.js';
import { delay, getUserAgent } from '../../sdk/utils.js';
import { EnvironmentModel } from '../../flagsmith-engine/environments/models.js';
import { BaseOfflineHandler } from '../../sdk/offline_handlers.js';
import { Agent } from 'undici';

vi.mock('../../sdk/polling_manager');
test('test_flagsmith_starts_polling_manager_on_init_if_enabled', () => {
    new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    expect(EnvironmentDataPollingManager).toBeCalled();
});

test('test_flagsmith_local_evaluation_key_required', () => {
    expect(() => {
        new Flagsmith({
            environmentKey: 'bad.key',
            enableLocalEvaluation: true
        });
    }).toThrow('Using local evaluation requires a server-side environment key');
});

test('test_update_environment_sets_environment', async () => {
    const flg = flagsmith({
        environmentKey: 'ser.key'
    });
    const model = environmentModel(JSON.parse(environmentJSON));
    expect(await flg.getEnvironment()).toStrictEqual(model);
});

test('test_update_environment_handles_paginated_document', async () => {
    type EnvDocumentMockResponse = {
        responseHeader: string | null;
        page: any;
    };

    const createMockFetch = (pages: EnvDocumentMockResponse[]) => {
        let callCount = 0;
        return vi.fn((url: string, options?: RequestInit) => {
            if (url.includes('/environment-document')) {
                const document = envDocumentMockResponse[callCount];
                if (document) {
                    callCount++;

                    const responseHeaders: Record<string, string> = {};

                    if (document.responseHeader) {
                        responseHeaders['Link'] = `<${document.responseHeader}>; rel="next"`;
                    }

                    return Promise.resolve(
                        new Response(JSON.stringify(document.page), {
                            status: 200,
                            headers: responseHeaders
                        })
                    );
                }
            }
            return Promise.resolve(new Response('unknown url ' + url, { status: 404 }));
        });
    };

    const envDocumentMockResponse: EnvDocumentMockResponse[] = [
        {
            responseHeader: '/api/v1/environment-document?page=2',
            page: {
                id: 1,
                api_key: 'test-key',
                project: {
                    id: 1,
                    name: 'test',
                    organisation: {
                        id: 1,
                        name: 'Test Org',
                        feature_analytics: false,
                        persist_trait_data: true,
                        stop_serving_flags: false
                    },
                    hide_disabled_flags: false,
                    segments: []
                },
                feature_states: [
                    {
                        feature_state_value: 'first_page_feature_state',
                        multivariate_feature_state_values: [],
                        django_id: 81027,
                        feature: {
                            id: 15058,
                            type: 'STANDARD',
                            name: 'string_feature'
                        },
                        enabled: false
                    },
                    {
                        feature_state_value: 'second_page_feature_state',
                        multivariate_feature_state_values: [],
                        django_id: 81027,
                        feature: {
                            id: 15058,
                            type: 'STANDARD',
                            name: 'string_feature'
                        },
                        enabled: false
                    },
                    {
                        feature_state_value: 'third_page_feature_state',
                        multivariate_feature_state_values: [],
                        django_id: 81027,
                        feature: {
                            id: 15058,
                            type: 'STANDARD',
                            name: 'string_feature'
                        },
                        enabled: false
                    }
                ],
                identity_overrides: [{ id: 1, identifier: 'user1' }]
            }
        },
        {
            responseHeader: '/api/v1/environment-document?page=3',
            page: {
                api_key: 'test-key',
                project: {
                    id: 1,
                    name: 'test',
                    organisation: {
                        id: 1,
                        name: 'Test Org',
                        feature_analytics: false,
                        persist_trait_data: true,
                        stop_serving_flags: false
                    },
                    hide_disabled_flags: false,
                    segments: []
                },
                feature_states: [],
                identity_overrides: [{ id: 2, identifier: 'user2' }]
            }
        },
        {
            responseHeader: null,
            page: {
                api_key: 'test-key',
                project: {
                    id: 1,
                    name: 'test',
                    organisation: {
                        id: 1,
                        name: 'Test Org',
                        feature_analytics: false,
                        persist_trait_data: true,
                        stop_serving_flags: false
                    },
                    hide_disabled_flags: false,
                    segments: []
                },
                feature_states: [],
                identity_overrides: [{ id: 2, identifier: 'user3' }]
            }
        }
    ];

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        fetch: createMockFetch(envDocumentMockResponse)
    });

    const environment = await flg.getEnvironment();

    expect(environment.identityOverrides).toHaveLength(3);
    expect(environment.identityOverrides[0].identifier).toBe('user1');
    expect(environment.identityOverrides[1].identifier).toBe('user2');
    expect(environment.identityOverrides[2].identifier).toBe('user3');
    expect(environment.featureStates).toHaveLength(3);
    expect(environment.featureStates[0].getValue()).toBe('first_page_feature_state');
    expect(environment.featureStates[1].getValue()).toBe('second_page_feature_state');
    expect(environment.featureStates[2].getValue()).toBe('third_page_feature_state');
    expect(environment.project.name).toBe('test');
    expect(environment.project.organisation.name).toBe('Test Org');
    expect(environment.project.organisation.id).toBe(1);
});

test('test_set_agent_options', async () => {
    const agent = new Agent({});

    fetch.mockImplementationOnce((url, options) => {
        //@ts-ignore I give up
        if (options.dispatcher !== agent) {
            throw new Error('Agent has not been set on retry fetch');
        }
        return Promise.resolve(new Response(environmentJSON));
    });

    const flg = flagsmith({
        agent
    });

    await flg.updateEnvironment();
});

test('test_get_identity_segments', async () => {
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
    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: false
    });
    const segments = await flg.getIdentitySegments('user', { age: 21 });
    expect(segments.length).toBe(0);
});

test('test_update_environment_uses_req_when_inited', async () => {
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });

    delay(400);

    expect(async () => {
        await flg.updateEnvironment();
    }).not.toThrow();
});

test('test_isFeatureEnabled_environment', async () => {
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true
    });

    const flags = await flg.getEnvironmentFlags();
    const featureValue = flags.isFeatureEnabled('some_feature');

    expect(featureValue).toBe(true);
});

test('test_fetch_recovers_after_single_API_error', async () => {
    fetch.mockRejectedValueOnce('Error during fetching the API response');
    const flg = flagsmith({
        environmentKey: 'key'
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('some-value');
});

test.each([
    [false, 'key'],
    [true, 'ser.key']
])(
    'default flag handler is used when API is unavailable (local evaluation = %s)',
    async (enableLocalEvaluation, environmentKey) => {
        const flg = flagsmith({
            enableLocalEvaluation,
            environmentKey,
            defaultFlagHandler: () => new DefaultFlag('some-default-value', true),
            fetch: badFetch
        });
        const flags = await flg.getEnvironmentFlags();
        const flag = flags.getFlag('some_feature');
        expect(flag.isDefault).toBe(true);
        expect(flag.enabled).toBe(true);
        expect(flag.value).toBe('some-default-value');
    }
);

test('default flag handler used when timeout occurs', async () => {
    fetch.mockImplementation(async (...args) => {
        const forever = new Promise(() => {});
        await forever;
        throw new Error('waited forever');
    });

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = () => defaultFlag;

    const flg = flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        requestTimeoutSeconds: 0.0001
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
});

test('request timeout uses default if not provided', async () => {
    const flg = new Flagsmith({
        environmentKey: 'key'
    });

    expect(flg.requestTimeoutMs).toBe(10000);
});

test('test_throws_when_no_identityFlags_returned_due_to_error', async () => {
    const flg = flagsmith({
        environmentKey: 'key',
        fetch: badFetch
    });

    await expect(async () => await flg.getIdentityFlags('identifier')).rejects.toThrow();
});

test('test onEnvironmentChange is called when provided', async () => {
    const callback = vi.fn();

    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback
    });

    fetch.mockRejectedValueOnce(new Error('API error'));
    await flg.updateEnvironment().catch(() => {
        // Expected rejection
    });

    expect(callback).toBeCalled();
});

test('test onEnvironmentChange is called after error', async () => {
    const callback = vi.fn();
    const flg = new Flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        onEnvironmentChange: callback,
        fetch: badFetch
    });
    await flg.updateEnvironment();
    expect(callback).toHaveBeenCalled();
});

test('getIdentityFlags throws error if identifier is empty string', async () => {
    const flg = flagsmith({
        environmentKey: 'key'
    });

    await expect(flg.getIdentityFlags('')).rejects.toThrow(
        '`identifier` argument is missing or invalid.'
    );
});

test('getIdentitySegments throws error if identifier is empty string', async () => {
    const flg = flagsmith({
        environmentKey: 'key'
    });

    await expect(flg.getIdentitySegments('')).rejects.toThrow(
        '`identifier` argument is missing or invalid.'
    );
});

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

    const identityFlags: Flags = await flg.getIdentityFlags('identity');
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
        offlineMode: true
    });

    vi.spyOn(flg, 'getEnvironmentFlags');
    vi.spyOn(flg, 'getIdentityFlags');

    flg.environmentFlagsUrl = 'http://some.flagsmith.com/api/v1/environment-flags';
    flg.identitiesUrl = 'http://some.flagsmith.com/api/v1/identities';

    // Mock a 500 Internal Server Error response
    const errorResponse = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error'
    });

    fetch.mockResolvedValue(errorResponse);

    // When
    const environmentFlags: Flags = await flg.getEnvironmentFlags();
    expect(mock_offline_handler.getEnvironment).toHaveBeenCalledTimes(1);
    const identityFlags: Flags = await flg.getIdentityFlags('identity', {});

    // Then
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
    expect(() =>
        flagsmith({
            offlineHandler: new BaseOfflineHandler(),
            defaultFlagHandler: () => new DefaultFlag('foo', true)
        })
    ).toThrowError('ValueError: Cannot use both defaultFlagHandler and offlineHandler.');
});

test('cannot create Flagsmith client in remote evaluation without API key', () => {
    // When and Then
    expect(() => new Flagsmith({ environmentKey: '' })).toThrowError(
        'ValueError: environmentKey is required.'
    );
});

test('test_localEvaluation_true__identity_overrides_evaluated', async () => {
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });

    await flg.updateEnvironment();
    const flags = await flg.getIdentityFlags('overridden-id');
    expect(flags.getFeatureValue('some_feature')).toEqual('some-overridden-value');
});

test('getIdentityFlags succeeds if initial fetch failed then succeeded', async () => {
    const defaultFlagHandler = vi.fn(() => new DefaultFlag('mock-default-value', true));

    fetch.mockRejectedValue(new Error('Initial API error'));
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        defaultFlagHandler
    });

    const defaultFlags = await flg.getIdentityFlags('test-user');
    expect(defaultFlags.isFeatureEnabled('mock-default-value')).toBe(true);
    expect(defaultFlagHandler).toHaveBeenCalled();

    fetch.mockResolvedValue(new Response(environmentJSON));
    await flg.getEnvironment();
    const flags2 = await flg.getIdentityFlags('test-user');
    expect(flags2.isFeatureEnabled('some_feature')).toBe(true);
});

test('get_user_agent_extracts_version_from_package_json', async () => {
    const userAgent = getUserAgent();
    const packageJson = require('../../package.json');

    expect(userAgent).toBe(`flagsmith-nodejs-sdk/${packageJson.version}`);
});
