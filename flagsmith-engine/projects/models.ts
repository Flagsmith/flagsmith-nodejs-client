import { OrganisationModel } from '../organisations/models';
import { SegmentModel } from '../segments/models';

export class ProjectModel {
    id: number;
    name: string;
    organisation: OrganisationModel;
    hideDisabledFlags: boolean;
    segments: SegmentModel[] = [];

    constructor(
        id: number,
        name: string,
        hideDisabledFlags: boolean,
        organization: OrganisationModel
    ) {
        this.id = id;
        this.name = name;
        this.hideDisabledFlags = hideDisabledFlags;
        this.organisation = organization;
    }
}
