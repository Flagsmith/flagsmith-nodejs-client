import { pino, Logger } from 'pino';
import { Dispatcher } from 'undici-types';
import { Fetch, FlagsmithTraitValue, FlagsmithValue } from './types.js';
import { delay, getUserAgent } from './utils.js';
import { SDK_VERSION } from './version.js';

/** The only `$`-prefixed event name an SDK is allowed to send. **/
export const FLAG_EXPOSURE_EVENT = '$flag_exposure';

/** URL of Flagsmith's public events API. **/
export const DEFAULT_EVENTS_API_URL = 'https://events.api.flagsmith.com/';

const EVENTS_ENDPOINT = 'v1/events';

/** Number of buffered events that triggers a flush without waiting for the timer. **/
const DEFAULT_MAX_BUFFER = 1000;

/** Duration in milliseconds between two automatic flushes. **/
const DEFAULT_FLUSH_INTERVAL_MS = 10000;

const DEFAULT_REQUEST_TIMEOUT_MS = 3000;

/** Duration in milliseconds to wait before retrying a failed batch. **/
const DEFAULT_RETRY_BACKOFF_MS = 1000;

/** How many times a single batch is posted before it is dropped. **/
const MAX_ATTEMPTS = 2;

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
    /** Number of buffered events that triggers a flush. Defaults to {@link DEFAULT_MAX_BUFFER}. **/
    maxBuffer?: number;
    /** Duration in milliseconds between automatic flushes. 0 disables the timer. Defaults to {@link DEFAULT_FLUSH_INTERVAL_MS}. **/
    flushInterval?: number;
    /** Duration in milliseconds to wait for API requests to complete before timing out. Defaults to {@link DEFAULT_REQUEST_TIMEOUT_MS}. **/
    requestTimeoutMs?: number;
    /** Duration in milliseconds to wait before retrying a failed batch. Defaults to {@link DEFAULT_RETRY_BACKOFF_MS}. **/
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
 * Events are flushed every {@link EventProcessorOptions.flushInterval} milliseconds, as soon as
 * {@link EventProcessorOptions.maxBuffer} events are buffered, or by calling {@link flush}.
 *
 * Exposure events are deduplicated within a flush window. A batch that cannot be posted is retried
 * once and then dropped: recording events must never fail the calling application, so all errors
 * are logged and swallowed.
 */
export class EventProcessor {
    private eventsUrl: string;
    private environmentKey: string;
    private customFetch: Fetch;
    private agent?: Dispatcher;
    private customHeaders?: { [key: string]: string };
    private maxBuffer: number;
    private flushInterval: number;
    private requestTimeoutMs: number;
    private retryBackoffMs: number;
    private logger: Logger;

    private buffer: FlagsmithEvent[] = [];
    private seenExposures: Set<string> = new Set();
    private inFlight: Set<Promise<void>> = new Set();
    private interval?: NodeJS.Timeout;

    constructor(opts: EventProcessorOptions) {
        const eventsApiUrl = opts.eventsApiUrl || DEFAULT_EVENTS_API_URL;
        this.eventsUrl =
            (eventsApiUrl.endsWith('/') ? eventsApiUrl : `${eventsApiUrl}/`) + EVENTS_ENDPOINT;
        this.environmentKey = opts.environmentKey;
        this.customFetch = opts.fetch;
        this.agent = opts.agent;
        this.customHeaders = opts.customHeaders;
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
     * Resolves once every batch in flight when it was called has been posted or dropped, including
     * batches started by the flush timer or by reaching {@link EventProcessorOptions.maxBuffer}.
     * Every event tracked before the call has therefore been sent or dropped. Batches started after
     * the call are not awaited, so sustained traffic cannot keep this promise pending.
     */
    async flush(): Promise<void> {
        const events = this.buffer;
        this.buffer = [];
        this.seenExposures.clear();

        if (events.length) {
            const batch = this.postEvents(events);
            this.inFlight.add(batch);
            // Settle both ways: a rejection here would otherwise go unhandled.
            const forget = () => this.inFlight.delete(batch);
            batch.then(forget, forget);
        }

        // allSettled, not all: one failed batch must neither reject this promise nor stop it from
        // waiting for the others.
        await Promise.allSettled([...this.inFlight]);
    }

    /**
     * Start flushing events every {@link EventProcessorOptions.flushInterval} milliseconds.
     *
     * The timer is unref'd, so it never keeps the process alive on its own.
     */
    start(): void {
        if (this.interval || this.flushInterval <= 0) {
            return;
        }
        this.interval = setInterval(() => {
            this.flush();
        }, this.flushInterval);
        this.interval.unref?.();
    }

    /**
     * Stop the flush timer and post any remaining events.
     */
    async stop(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        return this.flush();
    }

    private bufferEvent(args: {
        event: string;
        featureName: string | null;
        identifier: string | null;
        value: FlagsmithValue;
        traits: Record<string, FlagsmithTraitValue> | null;
        metadata: Record<string, unknown> | null;
    }): void {
        try {
            const value = args.value != null ? String(args.value) : null;
            const metadata: Record<string, unknown> = {
                ...(args.metadata ?? {}),
                sdk_version: SDK_VERSION
            };

            if (args.event === FLAG_EXPOSURE_EVENT) {
                const key = JSON.stringify([
                    args.event,
                    args.featureName,
                    args.identifier,
                    value,
                    metadata['experiment_id'] ?? null
                ]);
                if (this.seenExposures.has(key)) {
                    this.logger.debug(
                        `Skipping duplicate exposure for feature "${args.featureName}" in this flush window.`
                    );
                    return;
                }
                this.seenExposures.add(key);
            }

            this.buffer.push({
                event: args.event,
                feature_name: args.featureName,
                identifier: args.identifier,
                value: value,
                traits: args.traits,
                metadata: metadata,
                timestamp: Date.now()
            });

            if (this.buffer.length >= this.maxBuffer) {
                this.flush();
            }
        } catch (error) {
            // Recording an event must never throw into the calling application.
            this.logger.warn(error, `Failed to record the "${args.event}" event.`);
        }
    }

    /**
     * Post a batch, retrying once on a network error or a 5xx response before dropping it.
     *
     * A batch is never re-queued into the live buffer: a permanently rejected batch would otherwise
     * be retried forever.
     */
    private async postEvents(events: FlagsmithEvent[]): Promise<void> {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            let reason = 'unknown error';
            try {
                // built-in RequestInit type doesn't have dispatcher/agent
                const init: RequestInit & { dispatcher?: Dispatcher } = {
                    dispatcher: this.agent,
                    method: 'POST',
                    body: JSON.stringify({ events: events }),
                    signal: AbortSignal.timeout(this.requestTimeoutMs),
                    headers: {
                        // Custom headers first: the SDK's own headers must not be overridden.
                        ...(this.customHeaders ?? {}),
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Environment-Key': this.environmentKey,
                        // The events pipeline reads the SDK language and version from this header.
                        'Flagsmith-SDK-User-Agent': getUserAgent(),
                        'User-Agent': getUserAgent()
                    }
                };
                const response = await this.customFetch(this.eventsUrl, init);
                if (response.status >= 200 && response.status < 300) {
                    return;
                }
                if (response.status < 500) {
                    this.logger.warn(
                        `Flagsmith events API rejected ${events.length} events with status ${response.status}. Dropping them.`
                    );
                    return;
                }
                reason = `status ${response.status}`;
            } catch (error) {
                reason = String(error);
            }

            if (attempt === MAX_ATTEMPTS) {
                this.logger.warn(
                    `Failed to post ${events.length} events to the Flagsmith events API (${reason}). Dropping them.`
                );
                return;
            }
            await delay(this.retryBackoffMs);
        }
    }
}
