import { EnvironmentModel } from '../environments/models';
import { IdentityModel } from '../identities/models';
import { TraitModel } from '../identities/traits/models';
import { getHashedPercentateForObjIds } from '../utils/hashing';
import { PERCENTAGE_SPLIT, IS_SET, IS_NOT_SET } from './constants';
import { SegmentConditionModel, SegmentModel, SegmentRuleModel } from './models';
import constants_1 from "../../build/flagsmith-engine/segments/constants";

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
                identity.compositeKey
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
        return getHashedPercentateForObjIds([segmentId, identityId]) <= parseFloat(<string>condition.value);
    } else if (condition.operator === IS_SET || condition.operator === IS_NOT_SET) {
        return handleTraitExistenceConditions (condition, identityTraits);
    } else {
        const traits = identityTraits.filter(t => t.traitKey === condition.property_);const trait = traits.length > 0 ? traits[0] : undefined;
        return trait ? condition.matchesTraitValue(trait.traitValue) : false;
    }
}
function handleTraitExistenceConditions (condition: SegmentConditionModel, identityTraits: TraitModel[] ) {
    let traitKeysArray: string[]=[]
    identityTraits.map(function (e){
        let objectKey = Object.keys (e);
        traitKeysArray.push(objectKey[0])
    })
    if (condition.operator === IS_SET && condition.property_ != undefined) {
        return traitKeysArray.includes(condition.property_)
    }
    else
    {
        // @ts-ignore
        return !(traitKeysArray.includes(condition.property_))
    }
}