import Flagsmith from './index.js';
import { Logger } from 'pino';

export class EnvironmentDataPollingManager {
    private interval?: NodeJS.Timeout;
    private main: Flagsmith;
    private refreshIntervalSeconds: number;
    private logger: Logger;

    constructor(main: Flagsmith, refreshIntervalSeconds: number, logger: Logger) {
        this.main = main;
        this.refreshIntervalSeconds = refreshIntervalSeconds;
        this.logger = logger;
    }

    start() {
        const updateEnvironment = () => {
            if (this.interval) clearInterval(this.interval);
            this.interval = setInterval(async () => {
                try {
                    await this.main.updateEnvironment();
                } catch (error) {
                    this.logger.error('failed to poll environment', error);
                }
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
