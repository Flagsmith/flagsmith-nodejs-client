import { readFileSync } from 'fs';
import { buildEnvironmentModel } from '../../flagsmith-engine/environments/util';
import { AnalyticsProcessor } from '../../sdk/analytics';
import { Flagsmith } from '../../sdk';

const DATA_DIR = __dirname + '/data/';

export function analyticsProcessor() {
    return new AnalyticsProcessor({
        environmentKey: 'test-key',
        baseApiUrl: 'http://testUrl'
    });
}

export function apiKey(): string {
    return 'sometestfakekey';
}

export function flagsmith() {
    return new Flagsmith({
        environmentKey: apiKey()
    });
}

export function environmentJSON() {
    return readFileSync(DATA_DIR + 'environment.json', 'utf-8');
}

export function environmentModel(environmentJSON: any) {
    return buildEnvironmentModel(environmentJSON);
}

export function flagsJSON() {
    return readFileSync(DATA_DIR + 'flags.json', 'utf-8');
}

export function identitiesJSON() {
    return readFileSync(DATA_DIR + 'identities.json', 'utf-8');
}
