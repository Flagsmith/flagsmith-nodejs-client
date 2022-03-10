import fetch from 'node-fetch';

const ANALYTICS_ENDPOINT = 'analytics/flags/';
const ANALYTICS_TIMER = 10;

export class AnalyticsProcessor {
    private analyticsEndpoint: string;
    private environmentKey: string;
    private lastFlushed: number;
    analyticsData: { [key: string]: any };
    private timeout: number = 3;

    constructor(data: { environmentKey: string; baseApiUrl: string; timeout?: number }) {
        this.analyticsEndpoint = data.baseApiUrl + ANALYTICS_ENDPOINT;
        this.environmentKey = data.environmentKey;
        this.lastFlushed = Date.now();
        this.analyticsData = {};
        this.timeout = data.timeout || this.timeout;
    }

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

    trackFeature(featureId: number) {
        this.analyticsData[featureId] = (this.analyticsData[featureId] || 0) + 1;
        if (Date.now() - this.lastFlushed > ANALYTICS_TIMER * 1000) {
            this.flush();
        }
    }
}
