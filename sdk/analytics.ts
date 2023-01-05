import fetch from 'node-fetch';
import pino, { Logger } from 'pino';

const ANALYTICS_ENDPOINT = 'analytics/flags/';

// Used to control how often we send data(in seconds)
const ANALYTICS_TIMER = 10;

export class AnalyticsProcessor {
    private analyticsEndpoint: string;
    private environmentKey: string;
    private lastFlushed: number;
    analyticsData: { [key: string]: any };
    private requestTimeoutMs: number = 3000;
    private logger: Logger;

    /**
     * AnalyticsProcessor is used to track how often individual Flags are evaluated within
     * the Flagsmith SDK. Docs: https://docs.flagsmith.com/advanced-use/flag-analytics.
     *
     * @param data.environmentKey environment key obtained from the Flagsmith UI
     * @param data.baseApiUrl base api url to override when using self hosted version
     * @param data.requestTimeoutMs used to tell requests to stop waiting for a response after a
            given number of milliseconds
     */
    constructor(data: { environmentKey: string; baseApiUrl: string; requestTimeoutMs?: number, logger?: Logger }) {
        this.analyticsEndpoint = data.baseApiUrl + ANALYTICS_ENDPOINT;
        this.environmentKey = data.environmentKey;
        this.lastFlushed = Date.now();
        this.analyticsData = {};
        this.requestTimeoutMs = data.requestTimeoutMs || this.requestTimeoutMs;
        this.logger = data.logger || pino();
    }
    /**
     * Sends all the collected data to the api asynchronously and resets the timer
     */
    async flush() {
        if (!Object.keys(this.analyticsData).length) {
            return;
        }

        try {
            await fetch(this.analyticsEndpoint, {
                method: 'POST',
                body: JSON.stringify(this.analyticsData),
                timeout: this.requestTimeoutMs,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Environment-Key': this.environmentKey
                }
            })
        } catch (error) {
            // We don't want failing to write analytics to cause any exceptions in the main
            // thread so we just swallow them here.
            this.logger.warn('Failed to post analytics to Flagsmith API. Not clearing data, will retry.')
            return;
        }

        this.analyticsData = {};
        this.lastFlushed = Date.now();
    }

    trackFeature(featureName: string) {
        this.analyticsData[featureName] = (this.analyticsData[featureName] || 0) + 1;
        if (Date.now() - this.lastFlushed > ANALYTICS_TIMER * 1000) {
            this.flush();
        }
    }
}
