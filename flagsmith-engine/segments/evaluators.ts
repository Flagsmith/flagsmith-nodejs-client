import { JSONPath } from 'jsonpath-plus';
import {
    GenericEvaluationContext,
    InSegmentCondition,
    SegmentCondition,
    SegmentContext,
    SegmentRule
} from '../evaluation/models.js';
import { getHashedPercentageForObjIds } from '../utils/hashing/index.js';
import { SegmentConditionModel } from './models.js';
import { IS_NOT_SET, IS_SET, PERCENTAGE_SPLIT } from './constants.js';

/**
 * Returns all segments that the context belongs to based on segment rules evaluation.
 *
 * If the context has no segments, returns an empty array.
 *
 * @param context - Evaluation context containing identity and segment definitions
 * @returns Array of segments that the context matches
 */
export function getIdentitySegments(context: GenericEvaluationContext): SegmentContext[] {
    if (!context.segments) return [];

    return Object.values(context.segments).filter(segment => isContextInSegment(context, segment));
}

/**
 * Whether the context belongs to a segment, i.e. it matches ALL of the segment's rules.
 * A segment without rules matches no context.
 *
 * @param context - Evaluation context containing identity, traits, and environment
 * @param segment - The segment to evaluate
 * @returns true if the context matches every rule of the segment
 */
export function isContextInSegment(
    context: GenericEvaluationContext,
    segment: SegmentContext
): boolean {
    if (segment.rules.length === 0) return false;
    return segment.rules.every(rule => traitsMatchSegmentRule(rule, segment.key, context));
}

/**
 * Evaluates whether a segment condition matches the identity's traits or context values.
 *
 * Handles different types of conditions:
 * - PERCENTAGE_SPLIT: Deterministic percentage-based bucketing using identity key
 * - IS_SET/IS_NOT_SET: Checks for trait existence
 * - Standard operators: EQUAL, NOT_EQUAL, etc. via SegmentConditionModel
 * - JSONPath expressions: $.identity.identifier, $.environment.name, etc.
 *
 * @param condition - The condition to evaluate (property, operator, value)
 * @param segmentKey - Key of the segment (used for percentage split hashing)
 * @param context - Evaluation context containing identity, traits, and environment
 * @returns true if the condition matches
 */
export function traitsMatchSegmentCondition(
    condition: SegmentCondition | InSegmentCondition,
    segmentKey: string,
    context?: GenericEvaluationContext
): boolean {
    if (condition.operator === PERCENTAGE_SPLIT) {
        let splitKey: string | undefined;

        if (!condition.property) {
            splitKey = context?.identity?.key;
        } else {
            splitKey = getContextValue(condition.property, context);
        }

        if (!splitKey) {
            return false;
        }
        const hashedPercentage = getHashedPercentageForObjIds([segmentKey, splitKey]);
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
    context?: GenericEvaluationContext
): boolean {
    const matchesConditions = evaluateConditions(rule, segmentKey, context);
    const matchesSubRules = evaluateSubRules(rule, segmentKey, context);

    return matchesConditions && matchesSubRules;
}

function evaluateConditions(
    rule: SegmentRule,
    segmentKey: string,
    context?: GenericEvaluationContext
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
    context?: GenericEvaluationContext
): boolean {
    if (!rule.rules || rule.rules.length === 0) return true;

    const subRuleResults = rule.rules.map((subRule: SegmentRule) =>
        traitsMatchSegmentRule(subRule, segmentKey, context)
    );

    return evaluateRuleConditions(rule.type, subRuleResults);
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

const TRAITS_DOT_PATTERN = /^\$\.identity\.traits\.(.+)$/;
const TRAITS_BRACKET_PATTERN = /^\$\.identity\.traits\['(.+)'\]$/;

function extractTraitNameFromPath(property: string): string | undefined {
    return TRAITS_DOT_PATTERN.exec(property)?.[1] ?? TRAITS_BRACKET_PATTERN.exec(property)?.[1];
}

function getTraitValue(property: string, context?: GenericEvaluationContext): any {
    if (property.startsWith('$.')) {
        // Look up $.identity.traits.X and $.identity.traits['X'] paths directly
        // to avoid jsonpath-plus mis-parsing special characters (e.g. $, [, ]) in
        // trait names that appear inside bracket-notation strings.
        const traitName = extractTraitNameFromPath(property);
        if (traitName !== undefined) {
            return context?.identity?.traits?.[traitName];
        }
        const contextValue = getContextValue(property, context);
        if (contextValue !== undefined && isPrimitive(contextValue)) {
            return contextValue;
        }
    }
    const traits = context?.identity?.traits || {};

    return traits[property];
}

function isPrimitive(value: any): boolean {
    if (value === null || value === undefined) {
        return true;
    }

    // Objects and arrays are non-primitive
    return typeof value !== 'object';
}

const MEMBER_NAMES_PATH_PATTERN = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const UNSUPPORTED_PATH = Symbol('UNSUPPORTED_PATH');

/**
 * Resolves a JSONPath made of object member names only, e.g. `$.flags.my_feature.enabled`,
 * without the cost of a JSONPath evaluation. Other paths are left to JSONPath.
 */
function getMemberValue(jsonPath: string, json: object): unknown {
    if (!MEMBER_NAMES_PATH_PATTERN.test(jsonPath)) return UNSUPPORTED_PATH;

    let value: unknown = json;
    for (const memberName of jsonPath.slice(2).split('.')) {
        if (typeof value !== 'object' || value === null) return UNSUPPORTED_PATH;
        if (!Object.prototype.hasOwnProperty.call(value, memberName)) return undefined;
        value = (value as Record<string, unknown>)[memberName];
    }
    return value;
}

/**
 * Evaluates JSONPath expressions against the evaluation context.
 *
 * Supports accessing nested context values using JSONPath syntax.
 * Commonly used paths:
 * - $.identity.identifier - User's unique identifier
 * - $.identity.key - User's internal key
 * - $.environment.name - Environment name
 * - $.environment.key - Environment key
 *
 * @param jsonPath - JSONPath expression starting with '$.'
 * @param context - Evaluation context to query against
 * @returns The resolved value, or undefined if path doesn't exist or is invalid
 */
export function getContextValue(jsonPath: string, context?: GenericEvaluationContext): any {
    if (!context || !jsonPath?.startsWith('$.')) return undefined;

    const memberValue = getMemberValue(jsonPath, context);
    if (memberValue !== UNSUPPORTED_PATH) return memberValue;

    try {
        const results = JSONPath({ path: jsonPath, json: context });
        return results.length > 0 ? results[0] : undefined;
    } catch (error) {
        return undefined;
    }
}
