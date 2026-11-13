import { pino, Logger } from 'pino';
import { Dispatcher } from 'undici-types';
import { Fetch, FlagsmithTraitValue, FlagsmithValue } from './types.js';
import { getUserAgent } from './utils.js';
import { SDK_VERSION } from './version.js';

/** The only `$`-prefixed event name an SDK is allowed to send. **/
export const FLAG_EXPOSURE_EVENT = '$flag_exposure';

/** URL of Flagsmith's public events API. **/
export const DEFAULT_EVENTS_API_URL = 'https://events.api.flagsmith.com/';

const EVENTS_ENDPOINT = 'v1/events';

/** Number of events the buffer holds before it drops its oldest event. **/
const DEFAULT_MAX_BUFFER = 1000;

/** Duration in milliseconds between two automatic flushes. **/
const DEFAULT_FLUSH_INTERVAL_MS = 10000;

const DEFAULT_REQUEST_TIMEOUT_MS = 3000;

/** Upper bound in milliseconds of the wait before the first retry of a batch, doubled for each retry after it. **/
const DEFAULT_RETRY_BACKOFF_MS = 1000;

/** How many times a single batch is posted in one flush. **/
const MAX_ATTEMPTS = 3;

/** Statuses after which a batch is retried. Any other failing status drops it at once. **/
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Statuses meaning the events API is unavailable for now, rather than failing on the batch: a
 * batch whose last attempt gets one is kept for the next flush.
 */
const UNAVAILABLE_STATUSES = [408, 429, 502, 503, 504];

/** Statuses meaning the events API refuses the environment key. **/
const UNAUTHORISED_STATUSES = [401, 403];

/**
 * What became of a batch posted to the events API: `sent`, `dropped` because it cannot be sent,
 * `kept` to be sent again with the next flush, or `unauthorised` because the environment key was
 * refused.
 */
type Outcome = 'sent' | 'dropped' | 'kept' | 'unauthorised';

/** Headers the SDK sets itself. Header names are case-insensitive, so custom variants are dropped. **/
const RESERVED_HEADERS = [
    'content-type',
    'x-environment-key',
    'flagsmith-sdk-user-agent',
    'user-agent'
];

/** Options for an {@link EventProcessor}. **/
export interface EventProcessorOptions {
    /** Client-side or server-side key of the environment that events will be recorded for. **/
    environmentKey: string;
    /** {@link fetch} implementation to use for API requests. **/
    fetch: Fetch;
    /** Custom {@link Dispatcher} to use when making HTTP requests. **/
    agent?: Dispatcher;
    /** Custom headers to send with every request. The SDK's own headers take precedence. **/
    customHeaders?: { [key: string]: string };
    /** URL of the Flagsmith events API. Defaults to {@link DEFAULT_EVENTS_API_URL}. **/
    eventsApiUrl?: string;
    /** Number of events the buffer holds before it drops its oldest event. Defaults to {@link DEFAULT_MAX_BUFFER}. **/
    maxBuffer?: number;
    /** Duration in milliseconds between automatic flushes. 0 disables the timer. Defaults to {@link DEFAULT_FLUSH_INTERVAL_MS}. **/
    flushInterval?: number;
    /** Duration in milliseconds to wait for API requests to complete before timing out. Defaults to {@link DEFAULT_REQUEST_TIMEOUT_MS}. **/
    requestTimeoutMs?: number;
    /** Upper bound in milliseconds of the wait before the first retry of a batch, doubled for each retry after it. Defaults to {@link DEFAULT_RETRY_BACKOFF_MS}. **/
    retryBackoffMs?: number;
    /** Logger for dropped batches and other failures. Defaults to a new pino logger. **/
    logger?: Logger;
}

/**
 * A single event as sent to the Flagsmith events API.
 */
export interface FlagsmithEvent {
    /** The event name, e.g. `purchase` or {@link FLAG_EXPOSURE_EVENT}. **/
    event: string;
    /** The feature this event relates to. Required for {@link FLAG_EXPOSURE_EVENT}. **/
    feature_name: string | null;
    /** The identity this event relates to, used to reconcile exposures with conversions. **/
    identifier: string | null;
    /** The event's value, always stringified by the SDK. **/
    value: string | null;
    /** A flat map of resolved trait values. **/
    traits: Record<string, FlagsmithTraitValue> | null;
    /** Caller metadata, merged with the SDK version. **/
    metadata: Record<string, unknown>;
    /** Epoch milliseconds at which this event was buffered. **/
    timestamp: number;
}

/**
 * Buffers events and posts them to the Flagsmith events API.
 *
 * Events are flushed every {@link EventProcessorOptions.flushInterval} milliseconds, or by calling
 * {@link flush}. Flushes run one after the other, so a single batch is in flight at a time, and a
 * timer tick is skipped while a flush is running or queued. An event tracked while
 * {@link EventProcessorOptions.maxBuffer} events are buffered flushes them, unless a batch is
 * already in flight or kept from a failed flush: the new event then drops the oldest one instead.
 *
 * Exposure events are deduplicated within a flush window. A batch that fails with a network error,
 * a timeout or a 408, 429, 500, 502, 503 or 504 response is retried after a backoff with full
 * jitter, up to {@link MAX_ATTEMPTS} attempts in a flush. If its last attempt finds the events API
 * unavailable (anything but a 500), the batch is kept and sent with the next flush, ahead of the
 * events buffered since. Otherwise a failing batch is dropped. A 401 or 403 response means the
 * environment key is refused: the processor then drops every event and stops tracking.
 *
 * {@link stop} is terminal: events tracked or flushes requested after it are ignored.
 *
 * Recording events must never fail the calling application, so all errors are logged and
 * swallowed.
 */
export class EventProcessor {
    private eventsUrl: string;
    private environmentKey: string;
    private customFetch: Fetch;
    private agent?: Dispatcher;
    private customHeaders: { [key: string]: string };
    private maxBuffer: number;
    private flushInterval: number;
    private requestTimeoutMs: number;
    private retryBackoffMs: number;
    private logger: Logger;

    private buffer: FlagsmithEvent[] = [];
    /** Deduplication keys of the exposures in {@link buffer}, kept in sync with it. **/
    private seenExposures: Set<string> = new Set();
    /** The last flush requested, which every new flush runs after. Never rejects. **/
    private flushing: Promise<void> = Promise.resolve();
    /** Number of flushes running or queued. **/
    private pendingFlushes = 0;
    /** Set while the buffer starts with a batch kept from a failed flush. **/
    private hasKeptBatch = false;
    /** Set once {@link stop} has been called. **/
    private closed = false;
    private interval?: NodeJS.Timeout;
    /** Set once the events API refuses the environment key. **/
    private unauthorised = false;
    /** Aborts the request and backoff in flight when {@link stop} times out. **/
    private abortController = new AbortController();

    constructor(opts: EventProcessorOptions) {
        const eventsApiUrl = opts.eventsApiUrl || DEFAULT_EVENTS_API_URL;
        this.eventsUrl =
            (eventsApiUrl.endsWith('/') ? eventsApiUrl : `${eventsApiUrl}/`) + EVENTS_ENDPOINT;
        this.environmentKey = opts.environmentKey;
        this.customFetch = opts.fetch;
        this.agent = opts.agent;
        this.customHeaders = Object.fromEntries(
            Object.entries(opts.customHeaders ?? {}).filter(
                ([name]) => !RESERVED_HEADERS.includes(name.toLowerCase())
            )
        );
        this.maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
        this.flushInterval = opts.flushInterval ?? DEFAULT_FLUSH_INTERVAL_MS;
        this.requestTimeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        this.retryBackoffMs = opts.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
        this.logger = opts.logger || pino();
    }

    /**
     * Buffer a custom event.
     */
    trackEvent(args: {
        event: string;
        identifier: string | null;
        value: FlagsmithValue;
        traits: Record<string, FlagsmithTraitValue> | null;
        metadata: Record<string, unknown> | null;
    }): void {
        this.bufferEvent({
            event: args.event,
            featureName: null,
            identifier: args.identifier,
            value: args.value,
            traits: args.traits,
            metadata: args.metadata
        });
    }

    /**
     * Buffer a {@link FLAG_EXPOSURE_EVENT} for a feature.
     *
     * Exposures that are identical to one already buffered in this flush window are discarded.
     */
    trackExposureEvent(args: {
        featureName: string;
        identifier: string;
        value: FlagsmithValue;
        traits: Record<string, FlagsmithTraitValue> | null;
        metadata: Record<string, unknown> | null;
    }): void {
        this.bufferEvent({
            event: FLAG_EXPOSURE_EVENT,
            featureName: args.featureName,
            identifier: args.identifier,
            value: args.value,
            traits: args.traits,
            metadata: args.metadata
        });
    }

    /**
     * Post all buffered events to the Flagsmith events API.
     *
     * Runs after the flushes requested before it, so it resolves once every event tracked before
     * the call has been sent, dropped, or kept for the next flush because the events API is
     * unavailable. Never rejects. Does nothing once the processor is stopped.
     */
    flush(): Promise<void> {
        if (this.closed) {
            this.logger.warn('Not flushing events: the event processor is closed.');
            return this.flushing;
        }
        return this.queueFlush();
    }

    /**
     * Queue a flush after the flushes already requested. With none, it takes the buffer at once.
     */
    private queueFlush(): Promise<void> {
        const run = () => this.sendBuffer().finally(() => this.pendingFlushes--);
        const flush = this.pendingFlushes++ === 0 ? run() : this.flushing.then(run);
        this.flushing = flush;
        return flush;
    }

    /**
     * Start flushing events every {@link EventProcessorOptions.flushInterval} milliseconds.
     *
     * The timer is unref'd, so it never keeps the process alive on its own.
     */
    start(): void {
        if (this.interval || this.flushInterval <= 0 || this.closed) {
            return;
        }
        this.interval = setInterval(() => {
            // A tick must not queue flushes behind one that is still retrying.
            if (this.pendingFlushes === 0) {
                this.flush();
            }
        }, this.flushInterval);
        this.interval.unref?.();
    }

    /**
     * Stop the flush timer and post any remaining events. The processor ignores events tracked and
     * flushes requested afterwards.
     *
     * @param timeoutMs? how long to wait for the events to be sent. Once it has passed, the request
     * in flight is aborted, its events are lost, and this resolves. Waits for the flush to complete
     * if not set.
     */
    async stop(timeoutMs?: number): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        if (this.closed) {
            return;
        }
        this.closed = true;
        const flush = this.queueFlush();
        if (timeoutMs === undefined) {
            return flush;
        }

        let timer: NodeJS.Timeout | undefined;
        const timedOut = new Promise<boolean>(resolve => {
            timer = setTimeout(() => resolve(true), timeoutMs);
        });
        const expired = await Promise.race([flush.then(() => false), timedOut]);
        clearTimeout(timer);
        if (expired) {
            this.abortController.abort();
            try {
                this.logger.warn(
                    `Could not send the buffered events to the Flagsmith events API within ${timeoutMs}ms. Dropping them.`
                );
            } catch {
                // Closing must never fail the calling application.
            }
        }
    }

    private bufferEvent(args: {
        event: string;
        featureName: string | null;
        identifier: string | null;
        value: FlagsmithValue;
        traits: Record<string, FlagsmithTraitValue> | null;
        metadata: Record<string, unknown> | null;
    }): void {
        if (this.unauthorised) {
            return;
        }
        if (this.closed) {
            this.logger.warn(
                `Not recording the "${args.event}" event: the event processor is closed.`
            );
            return;
        }
        try {
            const value = args.value != null ? String(args.value) : null;
            const metadata: Record<string, unknown> = {
                ...(args.metadata ?? {}),
                sdk_version: SDK_VERSION
            };

            const event: FlagsmithEvent = {
                event: args.event,
                feature_name: args.featureName,
                identifier: args.identifier,
                value: value,
                traits: args.traits,
                metadata: metadata,
                timestamp: Date.now()
            };
            const exposureKey = exposureKeyOf(event);
            if (exposureKey !== undefined && this.seenExposures.has(exposureKey)) {
                this.logger.debug(
                    `Skipping duplicate exposure for feature "${args.featureName}" in this flush window.`
                );
                return;
            }

            if (this.buffer.length >= this.maxBuffer) {
                if (this.pendingFlushes === 0 && !this.hasKeptBatch) {
                    // Takes the full buffer at once, so the new event starts the next batch.
                    this.flush();
                } else {
                    this.forgetExposures([this.buffer.shift()!]);
                    this.logger.warn(
                        `The events buffer is full (${this.maxBuffer} events) while a batch is in flight or kept. Dropping its oldest event.`
                    );
                }
            }

            if (exposureKey !== undefined) {
                this.seenExposures.add(exposureKey);
            }
            this.buffer.push(event);
        } catch (error) {
            // Recording an event must never throw into the calling application.
            this.logger.warn(error, `Failed to record the "${args.event}" event.`);
        }
    }

    /**
     * Post the buffered events as one batch, and keep them for the next flush if the events API is
     * unavailable.
     */
    private async sendBuffer(): Promise<void> {
        if (!this.buffer.length || this.unauthorised) {
            return;
        }
        const events = this.buffer;
        this.buffer = [];
        this.seenExposures.clear();

        try {
            const outcome = await this.postEvents(events);
            this.hasKeptBatch = outcome === 'kept';
            if (outcome === 'kept') {
                this.restoreKeptBatch(events);
            } else if (outcome === 'unauthorised') {
                this.unauthorised = true;
                this.buffer = [];
                this.seenExposures.clear();
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = undefined;
                }
            }
        } catch (error) {
            // Only a throwing logger gets here: a flush must never reject.
        }
    }

    /**
     * Put a kept batch back ahead of the events tracked since, within the buffer's capacity.
     *
     * An exposure tracked during the flush may duplicate one in the batch: the batch's copy is kept.
     */
    private restoreKeptBatch(events: FlagsmithEvent[]): void {
        const merged = [...events, ...this.buffer];
        this.buffer = [];
        this.seenExposures.clear();
        for (const event of merged) {
            const key = exposureKeyOf(event);
            if (key !== undefined) {
                if (this.seenExposures.has(key)) {
                    continue;
                }
                this.seenExposures.add(key);
            }
            this.buffer.push(event);
        }

        const overflow = this.buffer.length - this.maxBuffer;
        if (overflow > 0) {
            this.forgetExposures(this.buffer.splice(0, overflow));
            this.logger.warn(
                `The events buffer is full (${this.maxBuffer} events). Dropping its ${overflow} oldest events.`
            );
        }
    }

    /** Stop deduplicating against exposures that have left the buffer without being sent. **/
    private forgetExposures(events: FlagsmithEvent[]): void {
        for (const event of events) {
            const key = exposureKeyOf(event);
            if (key !== undefined) {
                this.seenExposures.delete(key);
            }
        }
    }

    /**
     * Post a batch, retrying it after a network error, a timeout or a {@link RETRYABLE_STATUSES} status.
     */
    private async postEvents(events: FlagsmithEvent[]): Promise<Outcome> {
        const abortSignal = this.abortController.signal;
        for (let attempt = 1; ; attempt++) {
            // stop() may have timed out during the backoff: the next attempt must not be sent.
            if (abortSignal.aborted) {
                return 'dropped';
            }
            let reason: string;
            let unavailable = true;
            // Gives up on the request once it times out, or once stop() times out.
            const request = new AbortController();
            const giveUp = () => request.abort();
            const timeout = setTimeout(giveUp, this.requestTimeoutMs);
            abortSignal.addEventListener('abort', giveUp);
            try {
                // built-in RequestInit type doesn't have dispatcher/agent
                const init: RequestInit & { dispatcher?: Dispatcher } = {
                    dispatcher: this.agent,
                    method: 'POST',
                    body: JSON.stringify({ events: events }),
                    signal: request.signal,
                    headers: {
                        // Custom headers first: the SDK's own headers must not be overridden.
                        ...this.customHeaders,
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Environment-Key': this.environmentKey,
                        // The events pipeline reads the SDK language and version from this header.
                        'Flagsmith-SDK-User-Agent': getUserAgent(),
                        'User-Agent': getUserAgent()
                    }
                };
                const response = await this.customFetch(this.eventsUrl, init);
                const status = response.status;
                if (status >= 200 && status < 300) {
                    return 'sent';
                }
                if (UNAUTHORISED_STATUSES.includes(status)) {
                    this.logger.error(
                        `Flagsmith events API refused the environment key with status ${status}. Dropping ${events.length} events and no longer tracking events.`
                    );
                    return 'unauthorised';
                }
                unavailable = UNAVAILABLE_STATUSES.includes(status);
                if (!RETRYABLE_STATUSES.includes(status)) {
                    this.logger.warn(
                        `Flagsmith events API rejected ${events.length} events with status ${status}. Dropping them.`
                    );
                    return 'dropped';
                }
                reason = `status ${status}`;
            } catch (error) {
                reason = String(error);
            } finally {
                clearTimeout(timeout);
                abortSignal.removeEventListener('abort', giveUp);
            }

            if (abortSignal.aborted) {
                return 'dropped';
            }
            if (attempt === MAX_ATTEMPTS) {
                if (unavailable) {
                    this.logger.warn(
                        `Failed to post ${events.length} events to the Flagsmith events API (${reason}). Keeping them for the next flush.`
                    );
                    return 'kept';
                }
                this.logger.warn(
                    `Failed to post ${events.length} events to the Flagsmith events API (${reason}). Dropping them.`
                );
                return 'dropped';
            }
            // Full jitter: any wait up to the backoff, which doubles with each retry.
            await abortableDelay(
                Math.random() * this.retryBackoffMs * 2 ** (attempt - 1),
                abortSignal
            );
        }
    }
}

/** The key identical exposures share, or `undefined` for any other event. **/
function exposureKeyOf(event: FlagsmithEvent): string | undefined {
    if (event.event !== FLAG_EXPOSURE_EVENT) {
        return undefined;
    }
    return JSON.stringify([
        event.event,
        event.feature_name,
        event.identifier,
        event.value,
        event.metadata['experiment_id'] ?? null
    ]);
}

/** Resolve after `ms` milliseconds, or as soon as `signal` aborts. **/
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
        if (signal.aborted) {
            return resolve();
        }
        const done = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', done);
            resolve();
        };
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done);
    });
}
