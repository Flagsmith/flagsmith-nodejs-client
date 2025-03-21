import Flagsmith from '../../sdk/index.js';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, fetch } from './utils.js';
import { DefaultFlag } from '../../sdk/models.js';

vi.mock('../../sdk/polling_manager');

beforeEach(() => {
    vi.clearAllMocks();
});

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
  const defaultFlag = new DefaultFlag('some-default-value', true);

  const defaultFlagHandler = (featureName: string) => defaultFlag;

  const flg = flagsmith({
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
  const defaultFlag = new DefaultFlag('some-default-value', true);

  const defaultFlagHandler = (featureName: string) => defaultFlag;

  const flg = flagsmith({
      environmentKey: 'key',
      defaultFlagHandler: defaultFlagHandler,
      enableAnalytics: true,
  });

  const flags = await flg.getEnvironmentFlags();
  const featureValue = flags.getFeatureValue('some_feature');

  expect(featureValue).toBe('some-value');
});

test('test_throws_when_no_default_flag_handler_after_multiple_API_errors', async () => {
  fetch.mockRejectedValue('Error during fetching the API response');

  const flg = flagsmith({
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
