import fetch, { Headers } from 'node-fetch';
import {
  TestCache,
  TestCacheSync,
  environmentJSON,
  environmentModel,
  flagsJSON,
  flagsmith,
  identitiesJSON,
} from './utils';

jest.mock('node-fetch');
jest.mock('../../sdk/polling_manager');

const { Response } = jest.requireActual('node-fetch');

beforeEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

test('test_wrong_cache_interface_throws_an_error', async () => {
  const cache = {
    set: () => { },
    get: () => { },
  };

  expect(() => { const flg = flagsmith({ cache }); }).toThrow();
});

test('test_empty_cache_not_read_but_populated', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

  const cache = new TestCache();
  const set = jest.spyOn(cache, 'set');

  const flg = flagsmith({ cache });
  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(await cache.has('flags')).toBe(true);

  expect(fetch).toBeCalledTimes(1);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_api_not_called_when_cache_present', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

  const cache = new TestCache();
  const set = jest.spyOn(cache, 'set');

  const flg = flagsmith({ cache });
  await (await flg.getEnvironmentFlags()).allFlags();
  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(await cache.has('flags')).toBe(true);

  expect(fetch).toBeCalledTimes(1);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_api_called_twice_when_no_cache', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

  const flg = flagsmith();
  await (await flg.getEnvironmentFlags()).allFlags();
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));
  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(fetch).toBeCalledTimes(2);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_get_environment_flags_uses_local_environment_when_available', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(flagsJSON())));

  const cache = new TestCache();
  const set = jest.spyOn(cache, 'set');

  const flg = flagsmith({ cache });
  const model = environmentModel(JSON.parse(environmentJSON()));
  flg.environment = model;

  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(fetch).toBeCalledTimes(0);
  expect(allFlags[0].enabled).toBe(model.featureStates[0].enabled);
  expect(allFlags[0].value).toBe(model.featureStates[0].getValue());
  expect(allFlags[0].featureName).toBe(model.featureStates[0].feature.name);
});

test('test_cache_used_for_identity_flags', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(identitiesJSON())));

  const cache = new TestCache();
  const set = jest.spyOn(cache, 'set');

  const identifier = 'identifier';
  const traits = { some_trait: 'some_value' };
  const flg = flagsmith({ cache });

  (await flg.getIdentityFlags(identifier, traits)).allFlags();
  const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();

  expect(set).toBeCalled();
  expect(await cache.has('flags-identifier')).toBe(true);

  expect(fetch).toBeCalledTimes(1);

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_cache_used_for_identity_flags_local_evaluation', async () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));

  const cache = new TestCache();
  const set = jest.spyOn(cache, 'set');

  const identifier = 'identifier';
  const traits = { some_trait: 'some_value' };
  const flg = flagsmith({
    cache,
    environmentKey: 'ser.key',
    enableLocalEvaluation: true,
  });

  (await flg.getIdentityFlags(identifier, traits)).allFlags();
  const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();

  expect(set).toBeCalled();
  expect(await cache.has('flags-identifier')).toBe(true);

  expect(fetch).toBeCalledTimes(1);

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_cache_used_for_all_flags', async () => { });

test('test_cache_used_for_identity_flags_sync', async () => {
  // @ts-expect-error jest mocks not added to typedef
  fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));

  const cache = new TestCacheSync();
  const set = jest.spyOn(cache, 'set');

  const identifier = 'identifier';
  const traits = { some_trait: 'some_value' };
  const flg = flagsmith({
    cache,
    environmentKey: 'ser.key',
    enableLocalEvaluation: true,
  });

  await flg.readyCheck();

  flg.getIdentityFlagsSync(identifier, traits).allFlags();
  const identityFlags = flg.getIdentityFlagsSync(identifier, traits).allFlags();

  expect(set).toBeCalled();
  expect(cache.has('flags-identifier')).toBe(true);

  expect(fetch).toBeCalledTimes(1);

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_cache_used_for_identity_flags_sync_error', async () => {
  // @ts-expect-error jest mocks not added to typedef
  fetch.mockReturnValue(Promise.resolve(new Response(environmentJSON())));

  const cache = new TestCache();
  const identifier = 'identifier';

  const flg = flagsmith({
    cache,
    environmentKey: 'ser.key',
    enableLocalEvaluation: true,
  });

  await flg.readyCheck();

  expect(() => {
    flg.getIdentityFlagsSync(identifier);
  }).toThrow('returned a Promise');
});
