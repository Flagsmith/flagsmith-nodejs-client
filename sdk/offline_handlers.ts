import * as fs from 'fs';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util.js';
import { EnvironmentModel } from '../flagsmith-engine/environments/models.js';

export class BaseOfflineHandler {
    getEnvironment(): EnvironmentModel {
        throw new Error('Not implemented');
    }
}

/**
 * Handler for an environment document already in memory, as returned by the
 * `/api/v1/environment-document` endpoint and parsed.
 */
export class InMemoryHandler extends BaseOfflineHandler {
    environment: EnvironmentModel;
    constructor(environment_document: object) {
        super();
        this.environment = buildEnvironmentModel(environment_document);
    }

    getEnvironment(): EnvironmentModel {
        return this.environment;
    }
}

export class LocalFileHandler extends InMemoryHandler {
    constructor(environment_document_path: string) {
        super(JSON.parse(fs.readFileSync(environment_document_path, 'utf8')));
    }
}
