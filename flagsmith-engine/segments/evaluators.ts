import { EvaluationContext, IdentityContext, SegmentContext } from '../evaluationContext/models.js';
import { getHashedPercentageForObjIds } from '../utils/hashing/index.js';
import { SegmentConditionModel } from './models.js';
import { IS_NOT_SET, IS_SET, PERCENTAGE_SPLIT } from './constants.js';
import { EvaluationResult } from '../evaluationResult/models.js';

export function getIdentitySegments(context: EvaluationContext): EvaluationResult['segments'] {
    if (!context.identity || !context.segments) {
        return [];
    }

    return Object.values(context.segments).filter(segment =>
        evaluateIdentityInSegment(segment, context)
    );
}

export function evaluateIdentityInSegment(
    segment: SegmentContext,
    context?: EvaluationContext
): boolean {
    const result =
        segment.rules.length > 0 &&
        segment.rules.filter(rule => {
            const ruleResult = traitsMatchSegmentRule(rule, segment.key, context);
            return ruleResult;
        }).length === segment.rules.length;

    return result;
}

export function traitsMatchSegmentCondition(
    condition: SegmentConditionModel,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    const traits = context?.identity?.traits || {};
    const identityKey = context?.identity?.key || '';

    if (condition.operator === PERCENTAGE_SPLIT) {
        const hashedPercentage = getHashedPercentageForObjIds([segmentKey, identityKey]);
        return hashedPercentage <= parseFloat(String(condition.value));
    }
    if (!condition.property) {
        return false;
    }
    let traitValue = traits[condition.property];

    if (condition?.property?.startsWith('$.')) {
        traitValue = getContextValue(condition.property, context);
    } else {
        traitValue = traits[condition.property];
    }

    if (condition.operator === IS_SET) {
        return traitValue !== undefined && traitValue !== null;
    } else if (condition.operator === IS_NOT_SET) {
        return traitValue === undefined || traitValue === null;
    }

    if (traitValue !== undefined && traitValue !== null) {
        const segmentCondition = new SegmentConditionModel(
            condition.operator,
            condition.value,
            condition.property
        );
        return segmentCondition.matchesTraitValue(traitValue);
    }

    return false;
}

function traitsMatchSegmentRule(
    rule: any,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    const matchesConditions =
        rule.conditions && rule.conditions.length > 0
            ? evaluateRuleConditions(
                  rule.type,
                  rule.conditions.map((condition: any) =>
                      traitsMatchSegmentCondition(condition, segmentKey, context)
                  )
              )
            : true;

    const matchesSubRules =
        rule.rules && rule.rules.length > 0
            ? rule.rules.filter((subRule: any) =>
                  traitsMatchSegmentRule(subRule, segmentKey, context)
              ).length === rule.rules.length
            : true;

    return matchesConditions && matchesSubRules;
}

function evaluateRuleConditions(ruleType: string, conditionResults: boolean[]): boolean {
    switch (ruleType) {
        case 'ALL':
            return conditionResults.length === 0 || conditionResults.every(result => result);
        case 'ANY':
            return conditionResults.length > 0 && conditionResults.some(result => result);
        case 'NONE':
            return conditionResults.length === 0 || conditionResults.every(result => !result);
        default:
            return false;
    }
}

function getContextValue(jsonPath: string, context?: EvaluationContext): any {
    if (!context) return undefined;

    switch (jsonPath) {
        case '$.identity.identifier':
            return context.identity?.identifier;
        case '$.environment.name':
            return context.environment?.name;
        case '$.environment.key':
            return context.environment?.key;
        default:
            return undefined;
    }
}
