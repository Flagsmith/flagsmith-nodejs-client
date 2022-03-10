import fetch from 'node-fetch';

const ANALYTICS_ENDPOINT = 'analytics/flags/';
const ANALYTICS_TIMER = 10;

export class AnalyticsProcessor {
    private analytics_endpoint: string;
    private environment_key: string;
    private _last_flushed: number;
    analytics_data: { [key: string]: any };
    private timeout: number = 3;

    constructor(data: { environment_key: string; base_api_url: string; timeout?: number }) {
        this.analytics_endpoint = data.base_api_url + ANALYTICS_ENDPOINT;
        this.environment_key = data.environment_key;
        this._last_flushed = Date.now();
        this.analytics_data = {};
        this.timeout = data.timeout || this.timeout;
    }

    async flush() {
        if (!Object.keys(this.analytics_data).length) {
            return;
        }

        await fetch(this.analytics_endpoint, {
            method: 'POST',
            body: JSON.stringify(this.analytics_data),
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Environment-Key': this.environment_key
            }
        });

        this.analytics_data = {};
        this._last_flushed = Date.now();
    }

    trackFeature(featureId: number) {
        this.analytics_data[featureId] = (this.analytics_data[featureId] || 0) + 1;
        if (Date.now() - this._last_flushed > ANALYTICS_TIMER * 1000) {
            this.flush();
        }
    }
}
