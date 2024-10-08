import * as fs from 'fs';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util.js';
import { EnvironmentModel } from '../flagsmith-engine/environments/models.js';

export class BaseOfflineHandler {
    getEnvironment() : EnvironmentModel {
        throw new Error('Not implemented');
    }
}

export class LocalFileHandler extends BaseOfflineHandler {
    environment: EnvironmentModel;
    constructor(environment_document_path: string) {
        super();
        const environment_document = fs.readFileSync(environment_document_path, 'utf8');
        this.environment = buildEnvironmentModel(JSON.parse(environment_document));
    }

    getEnvironment(): EnvironmentModel {
        return this.environment;
    }
}
