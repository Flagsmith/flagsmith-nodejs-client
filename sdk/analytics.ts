import fetch from 'node-fetch';

const ANALYTICS_ENDPOINT = 'analytics/flags/';

// Used to control how often we send data(in seconds)
const ANALYTICS_TIMER = 10;

export class AnalyticsProcessor {
    private analyticsEndpoint: string;
    private environmentKey: string;
    private lastFlushed: number;
    analyticsData: { [key: string]: any };
    private timeout: number = 3;
    /**
     * AnalyticsProcessor is used to track how often individual Flags are evaluated within 
     * the Flagsmith SDK. Docs: https://docs.flagsmith.com/advanced-use/flag-analytics.
     * 
     * @param data.environmentKey environment key obtained from the Flagsmith UI
     * @param data.baseApiUrl base api url to override when using self hosted version
     * @param data.timeout used to tell requests to stop waiting for a response after a
            given number of seconds
     */
    constructor(data: { environmentKey: string; baseApiUrl: string; timeout?: number }) {
        this.analyticsEndpoint = data.baseApiUrl + ANALYTICS_ENDPOINT;
        this.environmentKey = data.environmentKey;
        this.lastFlushed = Date.now();
        this.analyticsData = {};
        this.timeout = data.timeout || this.timeout;
    }
    /**
     * Sends all the collected data to the api asynchronously and resets the timer
     */
    async flush() {
        if (!Object.keys(this.analyticsData).length) {
            return;
        }

        await fetch(this.analyticsEndpoint, {
            method: 'POST',
            body: JSON.stringify(this.analyticsData),
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Environment-Key': this.environmentKey
            }
        });

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
