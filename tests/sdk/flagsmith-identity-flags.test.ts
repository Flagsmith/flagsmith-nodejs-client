import Flagsmith from '../../sdk/index.js';
import {
  fetch,
  environmentJSON,
  flagsmith,
  identitiesJSON,
  identityWithTransientTraitsJSON,
  transientIdentityJSON,
  badFetch
} from './utils.js';
import { DefaultFlag } from '../../sdk/models.js';

vi.mock('../../sdk/polling_manager');

beforeEach(() => {
  vi.clearAllMocks();
});


test('test_get_identity_flags_calls_api_when_no_local_environment_no_traits', async () => {
  fetch.mockResolvedValue(new Response(identitiesJSON));
  const identifier = 'identifier';

  const flg = flagsmith();

  const identityFlags = (await flg.getIdentityFlags(identifier)).allFlags();

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_get_identity_flags_uses_environment_when_local_environment_no_traits', async () => {
  fetch.mockResolvedValue(new Response(environmentJSON))
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
  fetch.mockResolvedValue(new Response(identitiesJSON))
  const identifier = 'identifier';
  const traits = { some_trait: 'some_value' };
  const flg = flagsmith();

  const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();

  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('test_default_flag_is_not_used_when_identity_flags_returned', async () => {
  fetch.mockResolvedValue(new Response(identitiesJSON))

  const defaultFlag = new DefaultFlag('some-default-value', true);

  const defaultFlagHandler = (featureName: string) => defaultFlag;

  const flg = flagsmith({
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
  fetch.mockResolvedValue(new Response(JSON.stringify({ flags: [], traits: [] })));

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

test('test_default_flag_is_used_when_no_identity_flags_returned_due_to_error', async () => {
  fetch.mockResolvedValue(new Response('bad data'))

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
  fetch.mockResolvedValue(new Response(JSON.stringify({ flags: [], traits: [] })))

  const flg = flagsmith({
    environmentKey: 'key',
  });

  const flags = await flg.getIdentityFlags('identifier');
  const flag = flags.getFlag('some_feature');

  expect(flag.isDefault).toBe(true);
  expect(flag.value).toBe(undefined);
  expect(flag.enabled).toBe(false);
});

test('test_get_identity_flags_multivariate_value_with_local_evaluation_enabled', async () => {
  fetch.mockResolvedValue(new Response(environmentJSON));
  const identifier = 'identifier';

  const flg = flagsmith({
      environmentKey: 'ser.key',
      enableLocalEvaluation: true,

  });

  const identityFlags = (await flg.getIdentityFlags(identifier))

  expect(identityFlags.getFeatureValue('mv_feature')).toBe('bar');
  expect(identityFlags.isFeatureEnabled('mv_feature')).toBe(false);
});


test('test_transient_identity', async () => {
  fetch.mockResolvedValue(new Response(transientIdentityJSON));
  const identifier = 'transient_identifier';
  const traits = { some_trait: 'some_value' };
  const traitsInRequest = [{trait_key:Object.keys(traits)[0],trait_value:traits.some_trait}]
  const transient = true;
  const flg = flagsmith();
  const identityFlags = (await flg.getIdentityFlags(identifier, traits, transient)).allFlags();

  expect(fetch).toHaveBeenCalledWith(
    `https://edge.api.flagsmith.com/api/v1/identities/`,
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Environment-Key': 'sometestfakekey' },
      body: JSON.stringify({identifier, traits: traitsInRequest, transient })
    }
  ));

  expect(identityFlags[0].enabled).toBe(false);
  expect(identityFlags[0].value).toBe('some-transient-identity-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});


test('test_identity_with_transient_traits', async () => {
  fetch.mockResolvedValue(new Response(identityWithTransientTraitsJSON));
  const identifier = 'transient_trait_identifier';
  const traits = {
    some_trait: 'some_value',
    another_trait: {value: 'another_value', transient: true},
    explicitly_non_transient_trait: {value: 'non_transient_value', transient: false}
  }
  const traitsInRequest = [
    {
      trait_key:Object.keys(traits)[0],
      trait_value:traits.some_trait,
    },
    {
      trait_key:Object.keys(traits)[1],
      trait_value:traits.another_trait.value,
      transient: true,
    },
    {
      trait_key:Object.keys(traits)[2],
      trait_value:traits.explicitly_non_transient_trait.value,
      transient: false,
    },
  ]
  const flg = flagsmith();

  const identityFlags = (await flg.getIdentityFlags(identifier, traits)).allFlags();
  expect(fetch).toHaveBeenCalledWith(
    `https://edge.api.flagsmith.com/api/v1/identities/`,
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Environment-Key': 'sometestfakekey' },
      body: JSON.stringify({identifier, traits: traitsInRequest})
    })
  );
  expect(identityFlags[0].enabled).toBe(true);
  expect(identityFlags[0].value).toBe('some-identity-with-transient-trait-value');
  expect(identityFlags[0].featureName).toBe('some_feature');
});

test('getIdentityFlags fails if API call failed and no default flag handler was provided', async () => {
  const flg = flagsmith({
    fetch: badFetch,
  })
  await expect(flg.getIdentityFlags('user'))
      .rejects
      .toThrow('getIdentityFlags failed and no default flag handler was provided')
})
