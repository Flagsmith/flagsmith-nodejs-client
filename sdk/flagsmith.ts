import fetch from 'node-fetch';
import { getEnvironmentFeatureStates, getIdentityFeatureStates } from '../flagsmith-engine';
import { EnvironmentModel } from '../flagsmith-engine/environments/models';
import { buildEnvironmentModel } from '../flagsmith-engine/environments/util';
import { IdentityModel } from '../flagsmith-engine/identities/models';
import { TraitModel } from '../flagsmith-engine/identities/traits/models';

import { AnalyticsProcessor } from './analytics';
import { FlagsmithAPIError, FlagsmithClientError } from './errors';

import { DefaultFlag, Flags } from './models';
import { EnvironmentDataPollingManager } from './polling_manager';
import { generate_identities_data } from './utils';

const DEFAULT_API_URL = 'https://api.flagsmith.com/api/v1/';

export class Flagsmith {
    environment_key?: string;
    api_url: string = DEFAULT_API_URL;
    custom_headers?: { [key: string]: any };
    request_timeout_seconds?: number;
    enable_local_evaluation?: boolean = false;
    environment_refresh_interval_seconds: number = 60;
    retries?: any;
    enable_analytics: boolean = false;
    default_flag_handler?: (featureName: string) => DefaultFlag;

    environment_flags_url: string;
    identities_url: string;
    environment_url: string;

    environment_data_polling_manager_thread?: EnvironmentDataPollingManager;
    environment?: EnvironmentModel;
    private _analytics_processor?: AnalyticsProcessor;

    constructor(data: {
        environment_key: string;
        api_url?: string;
        custom_headers?: { [key: string]: any };
        request_timeout_seconds?: number;
        enable_local_evaluation?: boolean;
        environment_refresh_interval_seconds?: number;
        retries?: any;
        enable_analytics?: boolean;
        default_flag_handler?: (featureName: string) => DefaultFlag;
    }) {
        this.environment_key = data.environment_key;
        this.api_url = data.api_url || this.api_url;
        this.custom_headers = data.custom_headers;
        this.request_timeout_seconds = data.request_timeout_seconds;
        this.enable_local_evaluation = data.enable_local_evaluation;
        this.environment_refresh_interval_seconds =
            data.environment_refresh_interval_seconds || this.environment_refresh_interval_seconds;
        this.retries = data.retries;
        this.enable_analytics = data.enable_analytics || false;
        this.default_flag_handler = data.default_flag_handler;

        this.environment_flags_url = `${this.api_url}flags/`;
        this.identities_url = `${this.api_url}identities/`;
        this.environment_url = `${this.api_url}environment-document/`;

        this.environment;
        if (this.enable_local_evaluation) {
            this.environment_data_polling_manager_thread = new EnvironmentDataPollingManager(
                this,
                this.environment_refresh_interval_seconds
            );
            this.environment_data_polling_manager_thread.start();
        }

        this._analytics_processor = data.enable_analytics
            ? new AnalyticsProcessor({
                  environment_key: this.environment_key,
                  base_api_url: this.api_url,
                  timeout: this.request_timeout_seconds
              })
            : undefined;
    }

    async getEnvironmentFlags(): Promise<Flags> {
        if (this.environment) {
            return new Promise(resolve => resolve(this._get_environment_flags_from_document()));
        }

        return this._get_environment_flags_from_api();
    }

    getIdentityFlags(identifier: string, traits?: { [key: string]: any }): Promise<Flags> {
        traits = traits || {};
        if (this.environment) {
            return new Promise(resolve =>
                resolve(this._get_identity_flags_from_document(identifier, traits || {}))
            );
        }
        return this._get_identity_flags_from_api(identifier, traits);
    }

    async update_environment() {
        this.environment = await this._get_environment_from_api();
    }

    private async _get_json_response(
        url: string,
        method: string,
        body?: { [key: string]: any }
    ): Promise<any> {
        const data = await fetch(url, {
            method: method,
            timeout: this.request_timeout_seconds || undefined,
            body: JSON.stringify(body)
        });

        if (data.status !== 200) {
            throw new FlagsmithAPIError(
                `Invalid request made to Flagsmith API. Response status code: ${data.status}`
            );
        }

        return data.json();
    }

    private async _get_environment_from_api() {
        const environment_data = await this._get_json_response(this.environment_url, 'GET');
        return buildEnvironmentModel(environment_data);
    }

    private _get_environment_flags_from_document() {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        return Flags.fromFeatureStateModels({
            featureStates: getEnvironmentFeatureStates(this.environment),
            analyticsProcessor: this._analytics_processor,
            defaultFlagHandler: this.default_flag_handler
        });
    }

    private _get_identity_flags_from_document(identifier: string, traits: { [key: string]: any }) {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        const identityModel = this._build_identity_model(identifier, Object.values(traits));
        const featureStates = getIdentityFeatureStates(this.environment, identityModel);

        return Flags.fromFeatureStateModels({
            featureStates: featureStates,
            analyticsProcessor: this._analytics_processor,
            defaultFlagHandler: this.default_flag_handler
        });
    }

    private async _get_environment_flags_from_api() {
        try {
            const apiFlags = await this._get_json_response(this.environment_flags_url, 'GET');
            return Flags.fromAPIFlags({
                apiFlags: apiFlags,
                analyticsProcessor: this._analytics_processor,
                defaultFlagHandler: this.default_flag_handler
            });
        } catch (e) {
            if (this.default_flag_handler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.default_flag_handler
                });
            }

            throw e;
        }
    }

    private async _get_identity_flags_from_api(identifier: string, traits: { [key: string]: any }) {
        try {
            const data = generate_identities_data(identifier, traits);
            const jsonResponse = await this._get_json_response(this.identities_url, 'POST', data);
            return Flags.fromAPIFlags({
                apiFlags: jsonResponse['flags'],
                analyticsProcessor: this._analytics_processor,
                defaultFlagHandler: this.default_flag_handler
            });
        } catch (e) {
            if (this.default_flag_handler) {
                return new Flags({
                    flags: {},
                    defaultFlagHandler: this.default_flag_handler
                });
            }

            throw e;
        }
    }

    private _build_identity_model(identifier: string, traits: any[]) {
        if (!this.environment) {
            throw new FlagsmithClientError(
                'Unable to build identity model when no local environment present.'
            );
        }

        const traitModels = traits.map(trait => new TraitModel(trait.key, trait.value));
        return new IdentityModel('0', traitModels, [], this.environment.apiKey, identifier);
    }

    stop() {}
}
