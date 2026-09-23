import { pino } from 'pino';
import { FLAG_EXPOSURE_EVENT } from '../../sdk/events.js';
import { DefaultFlag, Flag } from '../../sdk/models.js';
import { FlagsmithConfig } from '../../sdk/types.js';
import { SDK_VERSION } from '../../sdk/version.js';
import { fetch } from './fetchMock.js';
import { flagsmith, postedEvents, TestCache } from './utils.js';

vi.mock('../../sdk/polling_manager');

const isEsmBuild = process.env.ESM_BUILD === 'true';

/** A client with the events pipeline enabled and its flush timer disabled. */
function experimentsFlagsmith(params: FlagsmithConfig = {}) {
    return flagsmith({
        enableEvents: true,
        ...params,
        eventProcessorConfig: { flushInterval: 0, ...params.eventProcessorConfig }
    });
}

test('eventProcessorConfig without enableEvents throws at construction', () => {
    expect(() => flagsmith({ eventProcessorConfig: { maxBuffer: 10 } })).toThrow(
        'ValueError: eventProcessorConfig requires enableEvents: true.'
    );
});

test('getExperimentFlag throws when events are disabled', async () => {
    await expect(flagsmith().getExperimentFlag('some_feature', 'identifier')).rejects.toThrow(
        'ValueError: enableEvents must be true to use getExperimentFlag.'
    );
});

test('trackEvent throws when events are disabled', () => {
    expect(() => flagsmith().trackEvent('purchase')).toThrow(
        'ValueError: enableEvents must be true to track events.'
    );
});

test('trackExposureEvent throws when events are disabled', () => {
    expect(() =>
        flagsmith().trackExposureEvent('some_feature', { identifier: 'identifier' })
    ).toThrow('ValueError: enableEvents must be true to track events.');
});

test('flushEvents resolves when events are disabled', async () => {
    await expect(flagsmith().flushEvents()).resolves.toBeUndefined();
    expect(postedEvents()).toHaveLength(0);
});

test('events are also disabled in offline mode', async () => {
    const flg = flagsmith({
        offlineMode: true,
        offlineHandler: { getEnvironment: () => ({}) } as any,
        environmentKey: undefined,
        enableEvents: true
    });

    expect(() => flg.trackEvent('purchase')).toThrow(
        'ValueError: enableEvents must be true to track events.'
    );
});

test.each([FLAG_EXPOSURE_EVENT, '$purchase'])(
    'trackEvent rejects the reserved event name %s',
    event => {
        expect(() => experimentsFlagsmith().trackEvent(event)).toThrow(
            `ValueError: event names starting with "$" are reserved; use trackExposureEvent to record "${FLAG_EXPOSURE_EVENT}".`
        );
    }
);

test('trackEvent records a custom event', async () => {
    const flg = experimentsFlagsmith();

    flg.trackEvent('purchase', {
        identifier: 'user-123',
        value: 49,
        metadata: { currency: 'GBP' }
    });
    await flg.flushEvents();

    expect(postedEvents()).toEqual([
        expect.objectContaining({
            event: 'purchase',
            feature_name: null,
            identifier: 'user-123',
            value: '49',
            traits: null,
            metadata: { currency: 'GBP', sdk_version: SDK_VERSION }
        })
    ]);
});

test('trackEvent unwraps TraitConfig values', async () => {
    const flg = experimentsFlagsmith();

    flg.trackEvent('purchase', {
        identifier: 'user-123',
        traits: {
            plan: 'premium',
            age: { value: 30, transient: true }
        }
    });
    await flg.flushEvents();

    expect(postedEvents()[0].traits).toEqual({ plan: 'premium', age: 30 });
});

test('trackExposureEvent without an identifier logs and sends nothing', async () => {
    const logger = pino({ level: 'silent' });
    const warn = vi.spyOn(logger, 'warn');
    const flg = experimentsFlagsmith({ logger });

    flg.trackExposureEvent('some_feature', { identifier: '' });
    await flg.flushEvents();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requires an identifier'));
    expect(postedEvents()).toHaveLength(0);
});

test('getExperimentFlag records an exposure for an enrolled identity', async () => {
    const flg = experimentsFlagsmith();

    const flag = (await flg.getExperimentFlag('some_feature', 'user-123')) as Flag;

    expect(flag.value).toBe('some-value');
    expect(flag.variant).toBe('treatment');
    expect(flag.reason).toBe('SPLIT; weight=70.0');
    expect(flag.experiment).toEqual({
        id: 167,
        name: 'some_experiment',
        inExperiment: true
    });

    await flg.flushEvents();
    expect(postedEvents()).toEqual([
        expect.objectContaining({
            event: FLAG_EXPOSURE_EVENT,
            feature_name: 'some_feature',
            identifier: 'user-123',
            value: 'treatment',
            metadata: { experiment_id: 167, sdk_version: SDK_VERSION }
        })
    ]);
});

// Skip in ESM build: instanceof fails across module boundaries
test.skipIf(isEsmBuild)('getExperimentFlag returns a Flag for an enrolled identity', async () => {
    const flg = experimentsFlagsmith();

    expect(await flg.getExperimentFlag('some_feature', 'user-123')).toBeInstanceOf(Flag);
});

test('getExperimentFlag sends the resolved traits with the exposure', async () => {
    const flg = experimentsFlagsmith();

    await flg.getExperimentFlag('some_feature', 'user-123', {
        plan: 'premium',
        age: { value: 30, transient: true }
    });
    await flg.flushEvents();

    expect(postedEvents()[0].traits).toEqual({ plan: 'premium', age: 30 });
});

test.each([
    ['the identity is outside the rollout', 'not_enrolled_feature'],
    ['the feature has no experiment metadata', 'no_experiment_feature'],
    ['the feature is disabled', 'disabled_experiment_feature'],
    ['the feature was not found', 'missing_feature']
])('getExperimentFlag records no exposure when %s', async (_name, featureName) => {
    const flg = experimentsFlagsmith();

    await flg.getExperimentFlag(featureName, 'user-123');
    await flg.flushEvents();

    expect(postedEvents()).toHaveLength(0);
});

test('getExperimentFlag still returns the flag when the identity is outside the rollout', async () => {
    const flg = experimentsFlagsmith();

    const flag = (await flg.getExperimentFlag('not_enrolled_feature', 'user-123')) as Flag;

    expect(flag.variant).toBe('control');
    expect(flag.experiment?.inExperiment).toBe(false);
});

test('getExperimentFlag records no exposure for a feature served by the default flag handler', async () => {
    const flg = experimentsFlagsmith({
        defaultFlagHandler: () => new DefaultFlag('some-default-value', true)
    });

    const flag = await flg.getExperimentFlag('missing_feature', 'user-123');
    await flg.flushEvents();

    expect(flag.isDefault).toBe(true);
    expect(flag.value).toBe('some-default-value');
    expect(postedEvents()).toHaveLength(0);
});

test('getExperimentFlag records no exposure when evaluating locally', async () => {
    const flg = experimentsFlagsmith({
        environmentKey: 'ser.key',
        enableLocalEvaluation: true
    });

    const flag = (await flg.getExperimentFlag('some_feature', 'user-123')) as Flag;
    await flg.flushEvents();

    expect(flag.enabled).toBe(true);
    expect(flag.variant).toBeUndefined();
    expect(flag.experiment).toBeUndefined();
    expect(postedEvents()).toHaveLength(0);
});

test('getExperimentFlag records one exposure per identity', async () => {
    const flg = experimentsFlagsmith();

    await flg.getExperimentFlag('some_feature', 'user-123');
    await flg.getExperimentFlag('some_feature', 'user-456');
    await flg.flushEvents();

    expect(postedEvents().map(event => event.identifier)).toEqual(['user-123', 'user-456']);
});

test('getExperimentFlag deduplicates repeated exposures of the same identity', async () => {
    const flg = experimentsFlagsmith();

    await flg.getExperimentFlag('some_feature', 'user-123');
    await flg.getExperimentFlag('some_feature', 'user-123');
    await flg.flushEvents();

    expect(postedEvents()).toHaveLength(1);
});

test('getExperimentFlag records an exposure for flags served from the identity cache', async () => {
    const flg = experimentsFlagsmith({ cache: new TestCache() });

    await flg.getExperimentFlag('some_feature', 'user-123');
    await flg.flushEvents();
    await flg.getExperimentFlag('some_feature', 'user-123');
    await flg.flushEvents();

    const identityRequests = fetch.mock.calls.filter(([url]) =>
        String(url).includes('/identities')
    );
    expect(identityRequests).toHaveLength(1);
    expect(postedEvents().map(event => event.identifier)).toEqual(['user-123', 'user-123']);
});

test('close flushes the buffered events', async () => {
    const flg = experimentsFlagsmith();

    flg.trackEvent('purchase', { identifier: 'user-123' });
    await flg.close();

    expect(postedEvents()).toHaveLength(1);
});

test('the events request carries the environment key and the SDK user agent headers', async () => {
    const flg = experimentsFlagsmith();

    flg.trackEvent('purchase', { identifier: 'user-123' });
    await flg.flushEvents();

    const [url, options] = fetch.mock.calls.find(([url]) => String(url).includes('/v1/events'))!;
    expect(url).toBe('https://events.api.flagsmith.com/v1/events');
    expect((options?.headers as Record<string, string>)['X-Environment-Key']).toBe(
        'sometestfakekey'
    );
    expect(JSON.parse(String(options?.body))).not.toHaveProperty('environment_key');
});

test('eventProcessorConfig is passed to the event processor', async () => {
    const flg = flagsmith({
        enableEvents: true,
        eventProcessorConfig: { eventsApiUrl: 'https://events.example.com', maxBuffer: 1 }
    });

    // Reaching maxBuffer posts the event without a flush.
    flg.trackEvent('purchase', { identifier: 'user-123' });

    expect(fetch).toHaveBeenCalledWith(
        'https://events.example.com/v1/events',
        expect.objectContaining({ method: 'POST' })
    );
    await flg.close();
});
