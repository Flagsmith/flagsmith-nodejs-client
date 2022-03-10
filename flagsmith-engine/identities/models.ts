import { FeatureStateModel } from '../features/models';
import { IdentityFeaturesList } from '../utils/collections';
import { TraitModel } from './traits/models';

const { v4: uuidv4 } = require('uuid');

export class IdentityModel {
    identifier: string;
    environmentApiKey: string;
    createdDate?: number;
    identityFeatures: IdentityFeaturesList;
    identityTraits: TraitModel[];
    identityUuid: string;
    djangoID: number | undefined;

    constructor(
        created_date: string,
        identity_traits: TraitModel[],
        identity_features: IdentityFeaturesList,
        environment_api_key: string,
        identifier: string,
        identity_uuid?: string
    ) {
        this.identityUuid = identity_uuid || uuidv4();
        this.createdDate = Date.parse(created_date) || Date.now();
        this.identityTraits = identity_traits;
        this.identityFeatures = new IdentityFeaturesList(...identity_features);
        this.environmentApiKey = environment_api_key;
        this.identifier = identifier;
    }

    get compositeKey() {
        return IdentityModel.generateCompositeKey(this.environmentApiKey, this.identifier);
    }

    static generateCompositeKey(env_key: string, identifier: string) {
        return `${env_key}_${identifier}`;
    }

    update_traits(traits: TraitModel[]) {
        const existingTraits: Map<string, TraitModel> = new Map();
        for (const trait of this.identityTraits) {
            existingTraits.set(trait.traitKey, trait);
        }

        for (const trait of traits) {
            if (!!trait.traitValue) {
                existingTraits.set(trait.traitKey, trait);
            } else {
                existingTraits.delete(trait.traitKey);
            }
        }

        this.identityTraits = [];

        for (const [k, v] of existingTraits.entries()) {
            this.identityTraits.push(v);
        }
    }
}
