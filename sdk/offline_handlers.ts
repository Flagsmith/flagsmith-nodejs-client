import * as fs from 'fs';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util.js';
import { EnvironmentModel } from '../flagsmith-engine/environments/models.js';

export class BaseOfflineHandler {
    getEnvironment(): EnvironmentModel {
        throw new Error('Not implemented');
    }
}

/**
 * Handler for an environment document that has already been loaded, from
 * wherever the application keeps it - an object store, a cache, a database, or
 * a document embedded in the deployment.
 *
 * The document is the JSON returned by the `/api/v1/environment-document`
 * endpoint, parsed. It is converted to an `EnvironmentModel` once, on
 * construction.
 */
export class EnvironmentDocumentHandler extends BaseOfflineHandler {
    environment: EnvironmentModel;
    constructor(environment_document: object) {
        super();
        this.environment = buildEnvironmentModel(environment_document);
    }

    getEnvironment(): EnvironmentModel {
        return this.environment;
    }
}

/**
 * Handler for an environment document stored on the local filesystem.
 */
export class LocalFileHandler extends EnvironmentDocumentHandler {
    constructor(environment_document_path: string) {
        super(JSON.parse(fs.readFileSync(environment_document_path, 'utf8')));
    }
}
