import {
    EvaluationContext,
    SegmentCondition,
    SegmentContext,
    SegmentRule
} from '../evaluationContext/models.js';
import { getHashedPercentageForObjIds } from '../utils/hashing/index.js';
import { SegmentConditionModel } from './models.js';
import { IS_NOT_SET, IS_SET, PERCENTAGE_SPLIT } from './constants.js';

export function getIdentitySegments(context: EvaluationContext): SegmentContext[] {
    if (!context.identity || !context.segments) return [];
    return Object.values(context.segments).filter(segment =>
        evaluateIdentityInSegment(segment, context)
    );
}

export function evaluateIdentityInSegment(
    segment: SegmentContext,
    context?: EvaluationContext
): boolean {
    if (segment.rules.length === 0) return false;

    return segment.rules.every(rule => traitsMatchSegmentRule(rule, segment.key, context));
}

export function traitsMatchSegmentCondition(
    condition: SegmentCondition,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    const identityKey = context?.identity?.key || '';

    if (condition.operator === PERCENTAGE_SPLIT) {
        const hashedPercentage = getHashedPercentageForObjIds([segmentKey, identityKey]);
        return hashedPercentage <= parseFloat(String(condition.value));
    }
    if (!condition.property) {
        return false;
    }

    const traitValue = getTraitValue(condition.property, context);

    if (condition.operator === IS_SET) {
        return traitValue !== undefined && traitValue !== null;
    }
    if (condition.operator === IS_NOT_SET) {
        return traitValue === undefined || traitValue === null;
    }

    if (traitValue !== undefined && traitValue !== null) {
        const segmentCondition = new SegmentConditionModel(
            condition.operator,
            condition.value as string,
            condition.property
        );
        return segmentCondition.matchesTraitValue(traitValue);
    }

    return false;
}

function traitsMatchSegmentRule(
    rule: SegmentRule,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    const matchesConditions = evaluateConditions(rule, segmentKey, context);
    const matchesSubRules = evaluateSubRules(rule, segmentKey, context);

    return matchesConditions && matchesSubRules;
}

function evaluateConditions(
    rule: SegmentRule,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    const conditionResults = rule.conditions.map((condition: SegmentCondition) =>
        traitsMatchSegmentCondition(condition, segmentKey, context)
    );

    return evaluateRuleConditions(rule.type, conditionResults);
}

function evaluateSubRules(
    rule: SegmentRule,
    segmentKey: string,
    context?: EvaluationContext
): boolean {
    if (!rule.rules || rule.rules.length === 0) return true;

    return rule.rules.every((subRule: SegmentRule) =>
        traitsMatchSegmentRule(subRule, segmentKey, context)
    );
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

function getTraitValue(property: string, context?: EvaluationContext): any {
    if (property.startsWith('$.')) {
        return getContextValue(property, context);
    }

    const traits = context?.identity?.traits || {};
    return traits[property];
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
