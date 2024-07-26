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
    transient?: boolean;

    constructor(
        created_date: string,
        identityTraits: TraitModel[],
        identityFeatures: IdentityFeaturesList,
        environmentApiKey: string,
        identifier: string,
        identityUuid?: string,
        djangoID?: number,
        transient?: boolean,
    ) {
        this.identityUuid = identityUuid || uuidv4();
        this.createdDate = Date.parse(created_date) || Date.now();
        this.identityTraits = identityTraits;
        this.identityFeatures = new IdentityFeaturesList(...identityFeatures);
        this.environmentApiKey = environmentApiKey;
        this.identifier = identifier;
        this.djangoID = djangoID;
        this.transient = transient;
    }

    get compositeKey() {
        return IdentityModel.generateCompositeKey(this.environmentApiKey, this.identifier);
    }

    static generateCompositeKey(env_key: string, identifier: string) {
        return `${env_key}_${identifier}`;
    }

    updateTraits(traits: TraitModel[]) {
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
