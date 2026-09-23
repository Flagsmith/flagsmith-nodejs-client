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
    // The endpoint is built from the events API URL whether or not it has a trailing slash.
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
            'X-Environment-Key': 'not-the-environment'
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

test('the buffer is flushed as soon as it reaches maxBuffer', async () => {
    const processor = eventProcessor({ maxBuffer: 2 });

    trackPurchase(processor);
    expect(fetch).not.toHaveBeenCalled();

    trackPurchase(processor, 'user-456');

    // Posted by reaching maxBuffer, before anything asks for a flush.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(postedEvents()).toHaveLength(2);

    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('flush waits for a batch posted by the flush timer', async () => {
    vi.useFakeTimers();
    const deferred = new Deferred<Response>();
    fetch.mockReturnValue(deferred.promise);

    const processor = eventProcessor({ flushInterval: 10000 });
    processor.start();
    trackPurchase(processor);

    // The timer starts a flush that never settles until the response is resolved.
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

test('flush waits for a batch posted by reaching maxBuffer', async () => {
    vi.useFakeTimers();
    const deferred = new Deferred<Response>();
    fetch.mockReturnValue(deferred.promise);

    const processor = eventProcessor({ maxBuffer: 1 });
    trackPurchase(processor);
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
});

test('flush does not wait for a batch started after it was called', async () => {
    const first = new Deferred<Response>();
    const second = new Deferred<Response>();
    fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const processor = eventProcessor();

    trackPurchase(processor);
    let firstFlushed = false;
    const firstFlush = processor.flush().then(() => {
        firstFlushed = true;
    });

    // Traffic keeps arriving while the first batch is on the wire.
    trackPurchase(processor, 'user-456');
    let secondFlushed = false;
    const secondFlush = processor.flush().then(() => {
        secondFlushed = true;
    });

    first.resolve(new Response(null, { status: 202 }));
    await firstFlush;
    await settle();
    expect(firstFlushed).toBe(true);
    expect(secondFlushed).toBe(false);

    second.resolve(new Response(null, { status: 202 }));
    await secondFlush;
    expect(secondFlushed).toBe(true);
});

test('flush waits for every in-flight batch even when one of them rejects', async () => {
    const pending = new Deferred<Response>();
    fetch
        .mockRejectedValueOnce(new Error('network unreachable'))
        .mockReturnValueOnce(pending.promise)
        .mockRejectedValueOnce(new Error('network unreachable'));
    const logger = pino({ level: 'silent' });
    // A throwing logger makes the dropped batch reject instead of resolving.
    vi.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('logger failure');
    });
    const processor = eventProcessor({ maxBuffer: 1, logger });

    // Each event reaches maxBuffer and starts its own batch.
    trackPurchase(processor);
    trackPurchase(processor, 'user-456');
    let flushed = false;
    const flush = processor.flush().finally(() => {
        flushed = true;
    });

    // The first batch has been retried and dropped, the second one is still on the wire.
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    await settle();
    expect(flushed).toBe(false);

    pending.resolve(new Response(null, { status: 202 }));
    await flush;
    expect(flushed).toBe(true);
});

test('a throwing logger cannot make flush reject', async () => {
    fetch.mockRejectedValue(new Error('network unreachable'));
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

test('a batch that fails to post is retried once after the backoff, then dropped', async () => {
    vi.useFakeTimers();
    fetch.mockRejectedValue(new Error('network unreachable'));

    const processor = eventProcessor({ retryBackoffMs: 1000, logger: silentLogger });
    trackPurchase(processor);

    const flush = processor.flush();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush;
    expect(fetch).toHaveBeenCalledTimes(2);

    // The batch is dropped rather than re-queued into the live buffer.
    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(2);
});

test('a batch rejected with a 5xx is retried once, then dropped', async () => {
    fetch.mockResolvedValue(new Response('downstream unavailable', { status: 503 }));

    const processor = eventProcessor({ logger: silentLogger });
    trackPurchase(processor);
    await processor.flush();

    expect(fetch).toHaveBeenCalledTimes(2);

    await processor.flush();
    expect(fetch).toHaveBeenCalledTimes(2);
});

test('a batch rejected with a 4xx is dropped without retrying', async () => {
    fetch.mockResolvedValue(new Response('malformed batch', { status: 400 }));

    const processor = eventProcessor({ logger: silentLogger });
    trackPurchase(processor);
    await processor.flush();

    expect(fetch).toHaveBeenCalledTimes(1);

    await processor.flush();
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
