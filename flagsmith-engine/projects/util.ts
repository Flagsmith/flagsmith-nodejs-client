import { buildOrganizationModel } from '../organisations/util';
import { SegmentModel } from '../segments/models';
import { buildSegmentModel } from '../segments/util';
import { ProjectModel } from './models';

export function buildProjectModel(projectJSON: any): ProjectModel {
    const segments: SegmentModel[] = projectJSON['segments']
        ? projectJSON['segments'].map((s: any) => buildSegmentModel(s))
        : [];
    const model = new ProjectModel(
        projectJSON.id,
        projectJSON.name,
        projectJSON.hide_disabled_flags,
        buildOrganizationModel(projectJSON.organisation)
    );
    model.segments = segments;
    return model;
}
