import Flagsmith from '../../sdk';
import fetch from 'node-fetch';
import { environmentJSON, environmentModel, flagsJSON, flagsmith, identitiesJSON } from './utils';
import { DefaultFlag } from '../../sdk/models';

jest.mock('node-fetch');
jest.mock('../../sdk/polling_manager');
const { Response } = jest.requireActual('node-fetch');

beforeEach(() => {
    // @ts-ignore
    jest.clearAllMocks();
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

  const flags = await flg.getEnvironmentFlags();
  const flag = flags.getFlag('some_feature');

  expect(flag.isDefault).toBe(false);
  expect(flag.value).not.toBe(defaultFlag.value);
  expect(flag.value).toBe('some-value');
});
