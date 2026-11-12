import { pino } from 'pino';
import { EventProcessor, FLAG_EXPOSURE_EVENT } from '../../sdk/events.js';
import { Deferred, getUserAgent } from '../../sdk/utils.js';
import { SDK_VERSION } from '../../sdk/version.js';
import { fetch } from './fetchMock.js';
import { eventProcessor, postedEvents } from './utils.js';

const silentLogger = pino({ level: 'silent' });

/** Buffer a custom event that only carries an identifier. */
function trackPurchase(processor: EventProcessor, identifier: string = 'user-123') {
    processor.trackEvent({
        event: 'purchase',
        identifier: identifier,
        value: null,
        traits: null,
        metadata: null
    });
}

/** Let every pending promise callback run. */
function settle() {
    return new Promise(resolve => setImmediate(resolve));
}

afterEach(() => {
    vi.useRealTimers();
});

test('trackEvent buffers an event with a stringified value, the SDK version and a timestamp', async () => {
    const processor = eventProcessor();

    processor.trackEvent({
        event: 'purchase',
        identifier: 'user-123',
        value: 49,
        traits: { plan: 'premium' },
        metadata: { currency: 'GBP' }
    });
    await processor.flush();

    const events = postedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
        event: 'purchase',
        feature_name: null,
        identifier: 'user-123',
        value: '49',
        traits: { plan: 'premium' },
        metadata: { currency: 'GBP', sdk_version: SDK_VERSION }
    });
    expect(Number.isInteger(events[0].timestamp)).toBe(true);
});

test('trackEvent keeps a missing value null', async () => {
    const processor = eventProcessor();

    processor.trackEvent({
        event: 'purchase',
        identifier: null,
        value: null,
        traits: null,
        metadata: null
    });
    await processor.flush();

    expect(postedEvents()[0]).toMatchObject({
        identifier: null,
        value: null,
        traits: null,
        metadata: { sdk_version: SDK_VERSION }
    });
});

test.each([
    [false, 'false'],
    [0, '0'],
    ['', '']
])('trackEvent stringifies the falsy value %p', async (value, expected) => {
    const processor = eventProcessor();

    processor.trackEvent({
        event: 'purchase',
        identifier: 'user-123',
        value: value,
        traits: null,
        metadata: null
    });
    await processor.flush();

    expect(postedEvents()[0].value).toBe(expected);
});

test('the SDK version wins over caller metadata', async () => {
    const processor = eventProcessor();

    processor.trackEvent({
        event: 'purchase',
        identifier: 'user-123',
        value: null,
        traits: null,
        metadata: { sdk_version: 'not-the-sdk-version' }
    });
    await processor.flush();

    expect(postedEvents()[0].metadata.sdk_version).toBe(SDK_VERSION);
});

test('trackExposureEvent buffers a $flag_exposure', async () => {
    const processor = eventProcessor();

    processor.trackExposureEvent({
        featureName: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        traits: null,
        metadata: { experiment_id: 167 }
    });
    await processor.flush();

    expect(postedEvents()[0]).toMatchObject({
        event: FLAG_EXPOSURE_EVENT,
        feature_name: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        metadata: { experiment_id: 167, sdk_version: SDK_VERSION }
    });
});

test('identical exposures are deduplicated within a flush window', async () => {
    const processor = eventProcessor();
    const exposure = {
        featureName: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        traits: null,
        metadata: { experiment_id: 167 }
    };

    processor.trackExposureEvent(exposure);
    processor.trackExposureEvent(exposure);
    await processor.flush();

    expect(postedEvents()).toHaveLength(1);
});

test.each([
    ['identifier', { identifier: 'user-456' }],
    ['value', { value: 'control' }],
    ['feature', { featureName: 'other_feature' }],
    ['experiment_id', { metadata: { experiment_id: 168 } }]
])('exposures differing by %s are not deduplicated', async (_name, difference) => {
    const processor = eventProcessor();
    const exposure = {
        featureName: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        traits: null,
        metadata: { experiment_id: 167 }
    };

    processor.trackExposureEvent(exposure);
    processor.trackExposureEvent({ ...exposure, ...difference });
    await processor.flush();

    expect(postedEvents()).toHaveLength(2);
});

test('an identical exposure is buffered again after a flush', async () => {
    const processor = eventProcessor();
    const exposure = {
        featureName: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        traits: null,
        metadata: { experiment_id: 167 }
    };

    processor.trackExposureEvent(exposure);
    await processor.flush();
    processor.trackExposureEvent(exposure);
    await processor.flush();

    expect(postedEvents()).toHaveLength(2);
});

test('custom events are never deduplicated', async () => {
    const processor = eventProcessor();
    const event = {
        event: 'purchase',
        identifier: 'user-123',
        value: '49.00',
        traits: null,
        metadata: null
    };

    processor.trackEvent(event);
    processor.trackEvent(event);
    await processor.flush();

    expect(postedEvents()).toHaveLength(2);
});

test('flush posts the batch to the events endpoint', async () => {
    const processor = eventProcessor({ eventsApiUrl: 'http://testUrl' });

    trackPurchase(processor);
    await processor.flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://testUrl/v1/events',
        expect.objectContaining({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Environment-Key': 'test-key',
                'Flagsmith-SDK-User-Agent': getUserAgent(),
                'User-Agent': getUserAgent()
            }
        })
    );

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(Object.keys(body)).toEqual(['events']);
    expect(body.events).toHaveLength(1);
});

test('flush posts through the configured dispatcher', async () => {
    const agent = { name: 'test-dispatcher' } as any;
    const processor = eventProcessor({ agent });

    trackPurchase(processor);
    await processor.flush();

    expect(fetch.mock.calls[0][1]).toMatchObject({ dispatcher: agent });
});

test('flush sends custom headers without letting them override the SDK headers', async () => {
    const processor = eventProcessor({
        customHeaders: {
            'X-Proxy-Token': 'secret',
            'Flagsmith-SDK-User-Agent': 'not-the-sdk',
            'x-environment-key': 'not-the-environment',
            'USER-AGENT': 'not-the-sdk'
        }
    });

    trackPurchase(processor);
    await processor.flush();

    expect(fetch.mock.calls[0][1]?.headers).toEqual({
        'X-Proxy-Token': 'secret',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Environment-Key': 'test-key',
        'Flagsmith-SDK-User-Agent': getUserAgent(),
        'User-Agent': getUserAgent()
    });
});

test('flush does not post anything when nothing is buffered', async () => {
    await eventProcessor().flush();

    expect(fetch).not.toHaveBeenCalled();
});

test('an event tracked while the buffer is full flushes it', async () => {
    const processor = eventProcessor({ maxBuffer: 2, logger: silentLogger });

    trackPurchase(processor, 'user-1');
    trackPurchase(processor, 'user-2');
    expect(fetch).not.toHaveBeenCalled();

    trackPurchase(processor, 'user-3');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(postedEvents().map(event => event.identifier)).toEqual(['user-1', 'user-2']);

    // The new event starts the next batch.
    await processor.flush();
    expect(postedEvents().map(event => event.identifier)).toEqual(['user-1', 'user-2', 'user-3']);
});

test('a full buffer drops its oldest event while a batch is in flight', async () => {
    const pending = new Deferred<Response>();
    fetch.mockReturnValueOnce(pending.promise);
    const processor = eventProcessor({ maxBuffer: 2, logger: silentLogger });

    trackPurchase(processor, 'user-1');
    const flush = processor.flush();
    trackPurchase(processor, 'user-2');
    trackPurchase(processor, 'user-3');
    trackPurchase(processor, 'user-4');
    expect(fetch).toHaveBeenCalledTimes(1);

    pending.resolve(new Response(null, { status: 202 }));
    await flush;
    await processor.flush();
    expect(postedEvents().map(event => event.identifier)).toEqual(['user-1', 'user-3', 'user-4']);
});

test('a full buffer drops its oldest event while it holds a kept batch', async () => {
    fetch
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const processor = eventProcessor({ maxBuffer: 2, logger: silentLogger });

    trackPurchase(processor, 'user-1');
    trackPurchase(processor, 'user-2');
    await processor.flush();
    trackPurchase(processor, 'user-3');
    expect(fetch).toHaveBeenCalledTimes(3);

    await processor.flush();
    const lastBatch = JSON.parse(String(fetch.mock.calls[3][1]?.body)).events;
    expect(lastBatch.map((event: any) => event.identifier)).toEqual(['user-2', 'user-3']);
});

test('a duplicate exposure neither drops nor flushes buffered events', async () => {
    const processor = eventProcessor({ maxBuffer: 1 });
    const exposure = {
        featureName: 'checkout_cta',
        identifier: 'user-123',
        value: 'treatment',
        traits: null,
        metadata: { experiment_id: 167 }
    };

    processor.trackExposureEvent(exposure);
    processor.trackExposureEvent(exposure);
    expect(fetch).not.toHaveBeenCalled();

    await processor.flush();
    expect(postedEvents()).toHaveLength(1);
});

test('a flush timer tick is skipped while a flush is running', async () => {
    vi.useFakeTimers();
    const pending = new Deferred<Response>();
    fetch.mockReturnValueOnce(pending.promise);
    const processor = eventProcessor({ flushInterval: 1000 });
    processor.start();

    trackPurchase(processor);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);

    trackPurchase(processor, 'user-456');
    await vi.advanceTimersByTimeAsync(5000);
    pending.resolve(new Response(null, { status: 202 }));
    await vi.advanceTimersByTimeAsync(0);
    // The ticks during the request queued nothing: the next tick sends the new event.
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await processor.stop();
});

test('flush waits for a batch posted by the flush timer', async () => {
    vi.useFakeTimers();
    const deferred = new Deferred<Response>();
    fetch.mockReturnValue(deferred.promise);

    const processor = eventProcessor({ flushInterval: 10000 });
    processor.start();
    trackPurchase(processor);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(1);

    let flushed = false;
    const flush = processor.flush().then(() => {
        flushed = true;
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(flushed).toBe(false);

    deferred.resolve(new Response(null, { status: 202 }));
    await flush;
    expect(flushed).toBe(true);

    await processor.stop();
});

test('flushes run one at a time, so a single batch is in flight', async () => {
    const first = new Deferred<Response>();
    const second = new Deferred<Response>();
    fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const processor = eventProcessor();

    trackPurchase(processor);
    let firstFlushed = false;
    const firstFlush = processor.flush().then(() => {
        firstFlushed = true;
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    trackPurchase(processor, 'user-456');
    let secondFlushed = false;
    const secondFlush = processor.flush().then(() => {
        secondFlushed = true;
    });
    await settle();
    // The second batch waits for the first one to be answered.
    expect(fetch).toHaveBeenCalledTimes(1);

    first.resolve(new Response(null, { status: 202 }));
    await firstFlush;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(firstFlushed).toBe(true);
    expect(secondFlushed).toBe(false);

    second.resolve(new Response(null, { status: 202 }));
    await secondFlush;
    expect(secondFlushed).toBe(true);
    expect(postedEvents().map(event => event.identifier)).toEqual(['user-123', 'user-456']);
});

test('a throwing logger cannot make flush reject', async () => {
    fetch.mockResolvedValue(new Response('server error', { status: 500 }));
    const logger = pino({ level: 'silent' });
    vi.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('logger failure');
    });
    const processor = eventProcessor({ logger });

    trackPurchase(processor);

    // An unhandled rejection from the dropped batch would also fail this test run.
    await expect(processor.flush()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
});

test('a failed batch is retried after a backoff with full jitter, doubling with each retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    fetch
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockRejectedValueOnce(new Error('connection reset'));

    const processor = eventProcessor({ retryBackoffMs: 1000, logger: silentLogger });
    trackPurchase(processor);

    const flush = processor.flush();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await flush;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(postedEvents()).toHaveLength(3);
});

test('the backoff is a random wait up to its bound', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

    const processor = eventProcessor({ retryBackoffMs: 1000, logger: silentLogger });
    trackPurchase(processor);

    const flush = processor.flush();
    await vi.advanceTimersByTimeAsync(250);
    await flush;
    expect(fetch).toHaveBeenCalledTimes(2);
});

test('a request the events API does not answer times out after 3 seconds by default', async () => {
    vi.useFakeTimers();
    fetch.mockImplementationOnce(
        (_url, options) =>
            new Promise((_resolve, reject) =>
                options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
            )
    );
    const processor = new EventProcessor({
        environmentKey: 'test-key',
        flushInterval: 0,
        retryBackoffMs: 0,
        fetch: (url, options) => fetch(url.toString(), options),
        logger: silentLogger
    });
    trackPurchase(processor);

    const flush = processor.flush();
    await vi.advanceTimersByTimeAsync(2990);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20);
    await flush;
    expect(fetch).toHaveBeenCalledTimes(2);
});

test.each([[503], [502], [504], [429], ['network error']])(
    'a batch whose last attempt finds the events API unavailable (%p) is sent with the next flush, ahead of newer events',
    async failure => {
        const response = () =>
            typeof failure === 'number'
                ? Promise.resolve(new Response(null, { status: failure }))
                : Promise.reject(new Error(failure));
        fetch
            .mockImplementationOnce(response)
            .mockImplementationOnce(response)
            .mockImplementationOnce(response);
        const processor = eventProcessor({ logger: silentLogger });

        trackPurchase(processor, 'user-1');
        await processor.flush();
        expect(fetch).toHaveBeenCalledTimes(3);

        trackPurchase(processor, 'user-2');
        await processor.flush();
        expect(fetch).toHaveBeenCalledTimes(4);
        const lastBatch = JSON.parse(String(fetch.mock.calls[3][1]?.body)).events;
        expect(lastBatch.map((event: any) => event.identifier)).toEqual(['user-1', 'user-2']);
    }
);

test('a kept batch makes room for newer events by dropping its oldest ones', async () => {
    fetch
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const processor = eventProcessor({ maxBuffer: 2, logger: silentLogger });

    trackPurchase(processor, 'user-1');
    trackPurchase(processor, 'user-2');
    await processor.flush();
    trackPurchase(processor, 'user-3');
    await processor.flush();

    const lastBatch = JSON.parse(String(fetch.mock.calls[3][1]?.body)).events;
    expect(lastBatch.map((event: any) => event.identifier)).toEqual(['user-2', 'user-3']);
});

test('a batch whose last attempt gets a server error is dropped', async () => {
    fetch
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const processor = eventProcessor({ logger: silentLogger });

    trackPurchase(processor);
    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(3);

    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(3);
});

test('a batch rejected with a 4xx is dropped without retrying', async () => {
    fetch.mockResolvedValueOnce(new Response('malformed batch', { status: 400 }));

    const processor = eventProcessor({ logger: silentLogger });
    trackPurchase(processor);
    await processor.flush();

    expect(fetch).toHaveBeenCalledTimes(1);

    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([401, 403])(
    'an events API refusing the environment key with %d stops event tracking',
    async status => {
        fetch.mockResolvedValueOnce(new Response(null, { status }));
        const processor = eventProcessor({ logger: silentLogger });

        trackPurchase(processor);
        await processor.flush();
        expect(fetch).toHaveBeenCalledTimes(1);

        trackPurchase(processor, 'user-456');
        await processor.flush();
        expect(fetch).toHaveBeenCalledTimes(1);
    }
);

test.each([501, 505])('a batch rejected with a %d is dropped without retrying', async status => {
    fetch.mockResolvedValueOnce(new Response(null, { status }));
    const processor = eventProcessor({ logger: silentLogger });

    trackPurchase(processor);
    await processor.flush();
    await processor.flush();

    expect(fetch).toHaveBeenCalledTimes(1);
});

test('a stop timeout during the backoff sends no further attempt', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    fetch.mockResolvedValue(new Response(null, { status: 503 }));
    const processor = eventProcessor({ retryBackoffMs: 1000, logger: silentLogger });
    trackPurchase(processor);

    const stop = processor.stop(500);
    await vi.advanceTimersByTimeAsync(500);
    await stop;
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('events tracked and flushes requested after stop are ignored', async () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const processor = eventProcessor({ flushInterval: 10000, logger: silentLogger });
    await processor.stop();

    trackPurchase(processor);
    await processor.flush();
    processor.start();

    expect(fetch).not.toHaveBeenCalled();
    expect(setInterval).not.toHaveBeenCalled();
});

test('stop with a timeout resolves once the events are sent', async () => {
    const processor = eventProcessor();
    trackPurchase(processor);

    await processor.stop(5000);

    expect(postedEvents()).toHaveLength(1);
});

test('stop with a timeout gives up on a request the events API does not answer', async () => {
    vi.useFakeTimers();
    let aborted = false;
    fetch.mockImplementation(
        (_url, options) =>
            new Promise((_resolve, reject) =>
                options?.signal?.addEventListener('abort', () => {
                    aborted = true;
                    reject(new Error('aborted'));
                })
            )
    );
    const processor = eventProcessor({ requestTimeoutMs: 3000, logger: silentLogger });
    trackPurchase(processor);

    let stopped = false;
    const stop = processor.stop(2000).then(() => {
        stopped = true;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(stopped).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await stop;
    expect(stopped).toBe(true);
    expect(aborted).toBe(true);

    // The aborted batch is not retried.
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('start does not let the flush timer keep the process alive', async () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const processor = eventProcessor({ flushInterval: 10000 });

    processor.start();
    // Starting twice must not leak a second timer.
    processor.start();

    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(setInterval.mock.results[0].value.hasRef()).toBe(false);

    await processor.stop();
});

test('start does nothing when the flush interval is disabled', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');

    eventProcessor({ flushInterval: 0 }).start();

    expect(setInterval).not.toHaveBeenCalled();
});

test('stop clears the flush timer and posts the buffered events', async () => {
    vi.useFakeTimers();
    const processor = eventProcessor({ flushInterval: 10000 });
    processor.start();
    trackPurchase(processor);

    await processor.stop();

    expect(vi.getTimerCount()).toBe(0);
    expect(postedEvents()).toHaveLength(1);
});
