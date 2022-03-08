import { FeatureStateModel } from '../features/models';
import { ProjectModel } from '../projects/models';
import { IntegrationModel } from './integrations/models';

export class EnvironmentAPIKeyModel {
    id: number;
    key: string;
    createdAt: number;
    name: string;
    clientApiKey: string;
    expiresAt?: number;
    active = true;

    constructor(
        id: number,
        key: string,
        created_at: number,
        name: string,
        client_api_key: string,
        expires_at?: number
    ) {
        this.id = id;
        this.key = key;
        this.createdAt = created_at;
        this.name = name;
        this.clientApiKey = client_api_key;
        this.expiresAt = expires_at;
    }

    isValid() {
        return !!this.active && (!this.expiresAt || this.expiresAt > Date.now());
    }
}

export class EnvironmentModel {
    id: number;
    apiKey: string;
    project: ProjectModel;
    featureStates: FeatureStateModel[] = [];
    amplitude_config?: IntegrationModel;
    segment_config?: IntegrationModel;
    mixpanel_config?: IntegrationModel;
    heap_config?: IntegrationModel;

    constructor(id: number, api_key: string, project: ProjectModel) {
        this.id = id;
        this.apiKey = api_key;
        this.project = project;
    }
}
