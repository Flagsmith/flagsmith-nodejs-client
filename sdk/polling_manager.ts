import Flagsmith from './index.js';

export class EnvironmentDataPollingManager {
    private interval?: NodeJS.Timeout;
    private main: Flagsmith;
    private refreshIntervalSeconds: number;

    constructor(main: Flagsmith, refreshIntervalSeconds: number) {
        this.main = main;
        this.refreshIntervalSeconds = refreshIntervalSeconds;
    }

    start() {
        const updateEnvironment = () => {
            if (this.interval) clearInterval(this.interval);
            this.interval = setInterval(async () => {
                await this.main.updateEnvironment();
            }, this.refreshIntervalSeconds * 1000);
        };
        updateEnvironment();
    }

    stop() {
        if (!this.interval) {
            return;
        }
        clearInterval(this.interval);
    }
}
