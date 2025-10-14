import { pino, Logger } from 'pino';
import { Fetch } from './types.js';
import { FlagsmithConfig } from './types.js';
import { getUserAgent } from './utils.js';

export const ANALYTICS_ENDPOINT = './analytics/flags/';

/** Duration in seconds to wait before trying to flush collected data after {@link trackFeature} is called. **/
const ANALYTICS_TIMER = 10;

const DEFAULT_REQUEST_TIMEOUT_MS = 3000;

export interface AnalyticsProcessorOptions {
    /** URL of the Flagsmith analytics events API endpoint
     * @example https://flagsmith.example.com/api/v1/analytics
     */
    analyticsUrl?: string;
    /** Client-side key of the environment that analytics will be recorded for. **/
    environmentKey: string;
    /** Duration in milliseconds to wait for API requests to complete before timing out. Defaults to {@link DEFAULT_REQUEST_TIMEOUT_MS}. **/
    requestTimeoutMs?: number;
    logger?: Logger;
    /** Custom {@link fetch} implementation to use for API requests. **/
    fetch?: Fetch;

    /** @deprecated Use {@link analyticsUrl} instead. **/
    baseApiUrl?: string;
}

/**
 * Tracks how often individual features are evaluated whenever {@link trackFeature} is called.
 *
 * Analytics data is posted after {@link trackFeature} is called and at least {@link ANALYTICS_TIMER} seconds have
 * passed since the previous analytics API request was made (if any), or by calling {@link flush}.
 *
 * Data will stay in memory indefinitely until it can be successfully posted to the API.
 * @see https://docs.flagsmith.com/advanced-use/flag-analytics.
 */
export class AnalyticsProcessor {
    private analyticsUrl: string;
    private environmentKey: string;
    private lastFlushed: number;
    analyticsData: { [key: string]: any };
    private requestTimeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS;
    private logger: Logger;
    private currentFlush: ReturnType<typeof fetch> | undefined;
    private customFetch: Fetch;

    constructor(data: AnalyticsProcessorOptions) {
        this.analyticsUrl = data.analyticsUrl || data.baseApiUrl + ANALYTICS_ENDPOINT;
        this.environmentKey = data.environmentKey;
        this.lastFlushed = Date.now();
        this.analyticsData = {};
        this.requestTimeoutMs = data.requestTimeoutMs || this.requestTimeoutMs;
        this.logger = data.logger || pino();
        this.customFetch = data.fetch ?? fetch;
    }
    /**
     * Try to flush pending collected data to the Flagsmith analytics API.
     */
    async flush() {
        if (this.currentFlush || !Object.keys(this.analyticsData).length) {
            return;
        }

        try {
            this.currentFlush = this.customFetch(this.analyticsUrl, {
                method: 'POST',
                body: JSON.stringify(this.analyticsData),
                signal: AbortSignal.timeout(this.requestTimeoutMs),
                headers: {
                    'Content-Type': 'application/json',
                    'X-Environment-Key': this.environmentKey,
                    'User-Agent': getUserAgent()
                }
            });
            await this.currentFlush;
        } catch (error) {
            // We don't want failing to write analytics to cause any exceptions in the main
            // thread so we just swallow them here.
            this.logger.warn(
                'Failed to post analytics to Flagsmith API. Not clearing data, will retry.'
            );
            return;
        } finally {
            this.currentFlush = undefined;
        }

        this.analyticsData = {};
        this.lastFlushed = Date.now();
    }

    /**
     * Track a single evaluation event for a feature.
     *
     * @see FlagsmithConfig.enableAnalytics
     */
    trackFeature(featureName: string) {
        this.analyticsData[featureName] = (this.analyticsData[featureName] || 0) + 1;
        if (Date.now() - this.lastFlushed > ANALYTICS_TIMER * 1000) {
            this.flush();
        }
    }
}
