export class OrganisationModel {
    id: number;
    name: string;
    featureAnalytics: boolean;
    stopServingFlags: boolean;
    persistTraitData: boolean;

    constructor(
        id: number,
        name: string,
        feature_analytics: boolean,
        stop_serving_flags: boolean,
        persist_trait_data: boolean
    ) {
        this.id = id;
        this.name = name;
        this.featureAnalytics = feature_analytics;
        this.stopServingFlags = stop_serving_flags;
        this.persistTraitData = persist_trait_data;
    }

    get unique_slug() {
        return this.id.toString() + '-' + this.name;
    }
}
