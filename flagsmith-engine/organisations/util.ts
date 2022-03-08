import { OrganisationModel } from './models';

export function buildOrganizationModel(organizationJSON: any): OrganisationModel {
    return new OrganisationModel(
        organizationJSON.id,
        organizationJSON.name,
        organizationJSON.feature_analytics,
        organizationJSON.stop_serving_flags,
        organizationJSON.persist_trait_data
    );
}
