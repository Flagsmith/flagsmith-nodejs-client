import { fetch, environmentJSON, environmentModel, flagsJSON, flagsmith, identitiesJSON, TestCache } from './utils.js';

beforeEach(() => {
  vi.clearAllMocks();
});

test('test_empty_cache_not_read_but_populated', async () => {
  fetch.mockResolvedValue(new Response(flagsJSON));

  const cache = new TestCache();
  const set = vi.spyOn(cache, 'set');

  const flg = flagsmith({ cache });
  const allFlags = (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(await cache.get('flags')).toBeTruthy();

  expect(fetch).toBeCalledTimes(1);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_api_not_called_when_cache_present', async () => {
  fetch.mockResolvedValue(new Response(flagsJSON));

  const cache = new TestCache();
  const set = vi.spyOn(cache, 'set');

  const flg = flagsmith({ cache });
  await (await flg.getEnvironmentFlags()).allFlags();
  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(await cache.get('flags')).toBeTruthy();

  expect(fetch).toBeCalledTimes(1);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_api_called_twice_when_no_cache', async () => {
  fetch.mockImplementation(() => Promise.resolve(new Response(flagsJSON)));

  const flg = flagsmith();
  await (await flg.getEnvironmentFlags()).allFlags();

  const allFlags = await (await flg.getEnvironmentFlags()).allFlags();

  expect(fetch).toBeCalledTimes(2);
  expect(allFlags[0].enabled).toBe(true);
  expect(allFlags[0].value).toBe('some-value');
  expect(allFlags[0].featureName).toBe('some_feature');
});

test('test_get_environment_flags_uses_local_environment_when_available', async () => {
  fetch.mockResolvedValue(new Response(flagsJSON));

  const cache = new TestCache();
  const set = vi.spyOn(cache, 'set');

  const flg = flagsmith({ cache, enableLocalEvaluation: true });
  const model = environmentModel(JSON.parse(environmentJSON));
  const getEnvironment = vi.spyOn(flg, 'getEnvironment')
  getEnvironment.mockResolvedValue(model)

  const allFlags = (await flg.getEnvironmentFlags()).allFlags();

  expect(set).toBeCalled();
  expect(fetch).toBeCalledTimes(0);
  expect(getEnvironment).toBeCalledTimes(1);
  expect(allFlags[0].enabled).toBe(model.featureStates[0].enabled);
  expect(allFlags[0].value).toBe(model.featureStates[0].getValue());
  expect(allFlags[0].featureName).toBe(model.featureStates[0].feature.name);
});

test('test_cache_used_for_identity_flags', async () => {
  fetch.mockResolvedValue(new Response(identitiesJSON));

  const cache = new TestCache();
  const set = vi.spyOn(cache, 'set');

  const identifier = 'identifier';
  const traits = { some_trait: 'some_value' };
  const flg = flagsmith({ cache });

  (await flg.getIdentityFlags(identifier, traits)).allFlags();
  const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();

  expect(set).toBeCalled();
  expect(await cache.get('flags-identifier')).toBeTruthy();

  expect(fetch).toBeCalledTimes(1);

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_cache_used_for_identity_flags_local_evaluation', async () => {
  fetch.mockResolvedValue(new Response(environmentJSON));

  const cache = new TestCache();
  const set = vi.spyOn(cache, 'set');

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
  expect(await cache.get('flags-identifier')).toBeTruthy();

  expect(fetch).toBeCalledTimes(1);

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});
