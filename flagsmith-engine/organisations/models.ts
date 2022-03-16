export class OrganisationModel {
    id: number;
    name: string;
    featureAnalytics: boolean;
    stopServingFlags: boolean;
    persistTraitData: boolean;

    constructor(
        id: number,
        name: string,
        featureAnalytics: boolean,
        stopServingFlags: boolean,
        persistTraitData: boolean
    ) {
        this.id = id;
        this.name = name;
        this.featureAnalytics = featureAnalytics;
        this.stopServingFlags = stopServingFlags;
        this.persistTraitData = persistTraitData;
    }

    get unique_slug() {
        return this.id.toString() + '-' + this.name;
    }
}
