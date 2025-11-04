import { EnvironmentModel } from '../environments/models.js';
import { IdentityModel } from '../identities/models.js';
import { TraitModel } from '../identities/traits/models.js';
import { getHashedPercentateForObjIds } from '../utils/hashing/index.js';
import { PERCENTAGE_SPLIT, IS_SET, IS_NOT_SET } from './constants.js';
import { SegmentConditionModel, SegmentModel, SegmentRuleModel } from './models.js';

export function getIdentitySegments(
    environment: EnvironmentModel,
    identity: IdentityModel,
    overrideTraits?: TraitModel[]
): SegmentModel[] {
    return environment.project.segments.filter(segment =>
        evaluateIdentityInSegment(identity, segment, overrideTraits)
    );
}

export function evaluateIdentityInSegment(
    identity: IdentityModel,
    segment: SegmentModel,
    overrideTraits?: TraitModel[]
): boolean {
    return (
        segment.rules.length > 0 &&
        segment.rules.filter(rule =>
            traitsMatchSegmentRule(
                overrideTraits || identity.identityTraits,
                rule,
                segment.id,
                identity.djangoID || identity.compositeKey
            )
        ).length === segment.rules.length
    );
}

function traitsMatchSegmentRule(
    identityTraits: TraitModel[],
    rule: SegmentRuleModel,
    segmentId: number | string,
    identityId: number | string
): boolean {
    const matchesConditions =
        rule.conditions.length > 0
            ? rule.matchingFunction()(
                  rule.conditions.map(condition =>
                      traitsMatchSegmentCondition(identityTraits, condition, segmentId, identityId)
                  )
              )
            : true;
    return (
        matchesConditions &&
        rule.rules.filter(rule =>
            traitsMatchSegmentRule(identityTraits, rule, segmentId, identityId)
        ).length === rule.rules.length
    );
}

export function traitsMatchSegmentCondition(
    identityTraits: TraitModel[],
    condition: SegmentConditionModel,
    segmentId: number | string,
    identityId: number | string
): boolean {
    if (condition.operator == PERCENTAGE_SPLIT) {
        var hashedPercentage = getHashedPercentateForObjIds([segmentId, identityId]);
        return hashedPercentage <= parseFloat(String(condition.value));
    }
    const traits = identityTraits.filter(t => t.traitKey === condition.property_);
    const trait = traits.length > 0 ? traits[0] : undefined;
    if (condition.operator === IS_SET) {
        return !!trait;
    } else if (condition.operator === IS_NOT_SET) {
        return trait == undefined;
    }
    return trait ? condition.matchesTraitValue(trait.traitValue) : false;
}
