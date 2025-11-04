import { EnvironmentModel } from '../../../flagsmith-engine/environments/models';
import { CONSTANTS } from '../../../flagsmith-engine/features/constants';
import { FeatureModel, FeatureStateModel } from '../../../flagsmith-engine/features/models';
import { IdentityModel } from '../../../flagsmith-engine/identities/models';
import { TraitModel } from '../../../flagsmith-engine/identities/traits/models';
import { OrganisationModel } from '../../../flagsmith-engine/organisations/models';
import { ProjectModel } from '../../../flagsmith-engine/projects/models';
import { ALL_RULE, EQUAL } from '../../../flagsmith-engine/segments/constants';
import {
    SegmentConditionModel,
    SegmentModel,
    SegmentRuleModel
} from '../../../flagsmith-engine/segments/models';

export const segmentConditionProperty = 'foo';
export const segmentConditionStringValue = 'bar';

export function segmentCondition() {
    return new SegmentConditionModel(EQUAL, segmentConditionStringValue, segmentConditionProperty);
}

export function traitMatchingSegment() {
    return new TraitModel(segmentCondition().property as string, segmentCondition().value);
}

export function organisation() {
    return new OrganisationModel(1, 'test Org', true, false, true);
}

export function segmentRule() {
    const rule = new SegmentRuleModel(ALL_RULE);
    rule.conditions = [segmentCondition()];
    return rule;
}

export function segment() {
    const segment = new SegmentModel(1, 'test name');
    segment.rules = [segmentRule()];
    return segment;
}

export function project() {
    const project = new ProjectModel(1, 'test project', false, organisation());
    project.segments = [segment()];
    return project;
}

export function feature1() {
    return new FeatureModel(1, 'feature_1', CONSTANTS.STANDARD);
}

export function feature2() {
    return new FeatureModel(2, 'feature_2', CONSTANTS.STANDARD);
}

export function environment() {
    const env = new EnvironmentModel(1, 'api-key', project());

    env.featureStates = [
        new FeatureStateModel(feature1(), true, 1),
        new FeatureStateModel(feature2(), false, 2)
    ];

    return env;
}

export function identity() {
    return new IdentityModel(Date.now().toString(), [], [], environment().apiKey, 'identity_1');
}

export function identityInSegment() {
    const identity = new IdentityModel(
        Date.now().toString(),
        [],
        [],
        environment().apiKey,
        'identity_2'
    );

    identity.identityTraits = [traitMatchingSegment()];

    return identity;
}

export function getEnvironmentFeatureStateForFeatureByName(
    environment: EnvironmentModel,
    feature_name: string
): FeatureStateModel | undefined {
    const features = environment.featureStates.filter(fs => fs.feature.name === feature_name);
    return features[0];
}

export function getEnvironmentFeatureStateForFeature(
    environment: EnvironmentModel,
    feature: FeatureModel
): FeatureStateModel | undefined {
    const f = environment.featureStates.find(f => f.feature === feature);
    return f;
}

export function segmentOverrideFs() {
    const fs = new FeatureStateModel(feature1(), false, 4);
    fs.setValue('segment_override');
    return fs;
}

export function environmentWithSegmentOverride(): EnvironmentModel {
    const env = environment();
    const segm = segment();

    segm.featureStates.push(segmentOverrideFs());
    env.project.segments.push(segm);
    return env;
}
