import Flagsmith from '../../sdk/index.js';
import { fetch, environmentJSON, flagsJSON } from './fetchMock.js';
import { environmentModel, flagsmith, TestCache } from './utils.js';
import { DefaultFlag } from '../../sdk/models.js';
import { getUserAgent } from '../../sdk/utils.js';

vi.mock('../../sdk/polling_manager');

test('test_get_environment_flags_calls_api_when_no_local_environment', async () => {
    const flg = flagsmith();
    const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

    expect(fetch).toBeCalledTimes(1);
    expect(allFlags[0].enabled).toBe(true);
    expect(allFlags[0].value).toBe('some-value');
    expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_default_flag_is_used_when_no_environment_flags_returned', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify([])));

    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = new Flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        customHeaders: {
            'X-Test-Header': '1'
        }
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');
    expect(flag.isDefault).toBe(true);
    expect(flag.enabled).toBe(defaultFlag.enabled);
    expect(flag.value).toBe(defaultFlag.value);
});

test('test_analytics_processor_tracks_flags', async () => {
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.value).toBe('some-value');
});

test('test_getFeatureValue', async () => {
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true
    });

    const flags = await flg.getEnvironmentFlags();
    const featureValue = flags.getFeatureValue('some_feature');

    expect(featureValue).toBe('some-value');
});

test('test_user_agent_is_set_when_fetching_environment_flags', async () => {
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = flagsmith({
        environmentKey: 'key',
        defaultFlagHandler: defaultFlagHandler,
        enableAnalytics: true
    });
    const flags = await flg.getEnvironmentFlags();
    const featureValue = flags.getFeatureValue('some_feature');

    expect(featureValue).toBe('some-value');
    expect(fetch).toHaveBeenCalledWith(
        `https://edge.api.flagsmith.com/api/v1/flags/`,
        expect.objectContaining({
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Environment-Key': 'key',
                'User-Agent': getUserAgent()
            }
        })
    );
});

test('test_throws_when_no_default_flag_handler_after_multiple_API_errors', async () => {
    fetch.mockRejectedValue('Error during fetching the API response');

    const flg = flagsmith({
        environmentKey: 'key'
    });

    await expect(async () => {
        const flags = await flg.getEnvironmentFlags();
        const flag = flags.getFlag('some_feature');
    }).rejects.toThrow('getEnvironmentFlags failed and no default flag handler was provided');
});

test('test_non_200_response_raises_flagsmith_api_error', async () => {
    const errorResponse403 = new Response('403 Forbidden', {
        status: 403
    });
    fetch.mockResolvedValue(errorResponse403);

    const flg = new Flagsmith({
        environmentKey: 'some'
    });

    await expect(flg.getEnvironmentFlags()).rejects.toThrow();
});
test('test_default_flag_is_not_used_when_environment_flags_returned', async () => {
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = flagsmith({
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
    fetch.mockResolvedValue(new Response('bad-data'));

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
    const defaultFlag = new DefaultFlag('some-default-value', true);

    const defaultFlagHandler = (featureName: string) => defaultFlag;

    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        defaultFlagHandler: defaultFlagHandler
    });

    const flags = await flg.getEnvironmentFlags();
    const flag = flags.getFlag('some_feature');

    expect(flag.isDefault).toBe(false);
    expect(flag.value).not.toBe(defaultFlag.value);
    expect(flag.value).toBe('some-value');
});

test.each([false, true])(
    'environment flag analytics work with local evaluation: %s',
    async enableLocalEvaluation => {
        vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) =>
            fetch(url.toString(), options)
        );
        const flg = flagsmith({
            environmentKey: 'ser.key',
            enableLocalEvaluation,
            enableAnalytics: true,
            cache: new TestCache()
        });
        const flags = await flg.getEnvironmentFlags();
        expect(flags.isFeatureEnabled('some_feature')).toBe(true);
        expect(flags.getFeatureValue('some_feature')).toBe('some-value');

        const cachedFlags = await flg.getEnvironmentFlags();
        expect(cachedFlags).toBe(flags);
        cachedFlags.getFlag('some_feature');
        await flags.analyticsProcessor?.flush();

        const analyticsRequests = fetch.mock.calls.filter(([url]) =>
            String(url).includes('/analytics/flags/')
        );
        expect(analyticsRequests).toHaveLength(1);
        expect(JSON.parse(String(analyticsRequests[0][1]?.body))).toEqual({
            some_feature: 3
        });
    }
);

test('local environment evaluation does not enable analytics by default', async () => {
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });
    const flags = await flg.getEnvironmentFlags();
    expect(flags.isFeatureEnabled('some_feature')).toBe(true);
    expect(flags.analyticsProcessor).toBeUndefined();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/analytics/flags/'))).toBe(false);
});

test('local environment flags preserve the default flag handler', async () => {
    const defaultFlag = new DefaultFlag('fallback-value', true);
    const flg = flagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true,
        defaultFlagHandler: () => defaultFlag
    });
    const flags = await flg.getEnvironmentFlags();
    expect(flags.getFlag('missing_feature')).toBe(defaultFlag);
});
