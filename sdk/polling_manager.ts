import { Flagsmith } from '.';

export class EnvironmentDataPollingManager {
    private interval?: NodeJS.Timer;
    private main: Flagsmith;
    private refreshIntervalSeconds: number;

    constructor(main: Flagsmith, refreshIntervalSeconds: number) {
        this.main = main;
        this.refreshIntervalSeconds = refreshIntervalSeconds;
    }

    start() {
        const updateEnvironemnt = () => {
            this.interval = setInterval(async () => {
                await this.main.update_environment();
            }, this.refreshIntervalSeconds * 1000);
        };
        // todo: this call should be awaited for getIdentityFlags/getEnvironmentFlags when enableLocalEvaluation is true
        this.main.update_environment()
        updateEnvironemnt()
    }

    stop() {
        if (!this.interval) {
            return;
        }
        clearInterval(this.interval);
    }
}
