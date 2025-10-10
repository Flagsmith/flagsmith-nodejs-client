import { EvaluationContext, FeatureContext } from './evaluation/models.js';
import { getIdentitySegments } from './segments/evaluators.js';
import { EvaluationResult, EvaluationResultFlags } from './evaluation/models.js';
import { TARGETING_REASONS } from './features/types.js';
import { getHashedPercentageForObjIds } from './utils/hashing/index.js';
export { EnvironmentModel } from './environments/models.js';
export { IdentityModel } from './identities/models.js';
export { TraitModel } from './identities/traits/models.js';
export { SegmentModel } from './segments/models.js';
export { FeatureModel, FeatureStateModel } from './features/models.js';
export { OrganisationModel } from './organisations/models.js';
type SegmentOverride = {
    feature: FeatureContext;
    segmentName: string;
};

export type SegmentOverrides = Record<string, SegmentOverride>;

/**
 * Evaluates flags and segments for the given context.
 *
 * This is the main entry point for the evaluation engine. It processes segments,
 * applies feature overrides based on segment priority, and returns the final flag states with
 * evaluation reasons.
 *
 * @param context - EvaluationContext containing environment, identity, and segment data
 * @returns EvaluationResult with flags, segments, and original context
 */
export function getEvaluationResult(context: EvaluationContext): EvaluationResult {
    const { segments, segmentOverrides } = evaluateSegments(context);
    const flags = evaluateFeatures(context, segmentOverrides);

    return { context, flags, segments };
}

/**
 * Evaluates which segments the identity belongs to and collects feature overrides.
 *
 * @param context - EvaluationContext containing identity and segment definitions
 * @returns Object containing segments the identity belongs to and any feature overrides
 */
export function evaluateSegments(context: EvaluationContext): {
    segments: EvaluationResult['segments'];
    segmentOverrides: Record<string, SegmentOverride>;
} {
    if (!context.identity || !context.segments) {
        return { segments: [], segmentOverrides: {} };
    }
    const identitySegments = getIdentitySegments(context);

    const segments = identitySegments.map(segment => ({
        key: segment.key,
        name: segment.name
    }));
    const segmentOverrides = processSegmentOverrides(identitySegments);

    return { segments, segmentOverrides };
}

/**
 * Processes feature overrides from segments, applying priority rules.
 *
 * When multiple segments override the same feature, the segment with
 * higher priority (lower numeric value) takes precedence.
 *
 * @param identitySegments - Segments that the identity belongs to
 * @returns Map of feature keys to their highest-priority segment overrides
 */
export function processSegmentOverrides(identitySegments: any[]): Record<string, SegmentOverride> {
    const segmentOverrides: Record<string, SegmentOverride> = {};

    for (const segment of identitySegments) {
        if (!segment.overrides) continue;

        const overridesList = Array.isArray(segment.overrides) ? segment.overrides : [];

        for (const override of overridesList) {
            if (shouldApplyOverride(override, segmentOverrides)) {
                segmentOverrides[override.feature_key] = {
                    feature: override,
                    segmentName: segment.name
                };
            }
        }
    }

    return segmentOverrides;
}

/**
 * Evaluates all features in the context, applying segment overrides where applicable.
 * For each feature:
 * - Checks if a segment override exists
 * - Uses override values if present, otherwise evaluates the base feature
 * - Determines appropriate evaluation reason
 * - Handles multivariate evaluation for features without overrides
 *
 * @param context - EvaluationContext containing features and identity
 * @param segmentOverrides - Map of feature keys to their segment overrides
 * @returns EvaluationResultFlags containing evaluated flag results
 */
export function evaluateFeatures(
    context: EvaluationContext,
    segmentOverrides: Record<string, SegmentOverride>
): EvaluationResultFlags {
    const flags: EvaluationResultFlags = [];

    for (const feature of Object.values(context.features || {})) {
        const segmentOverride = segmentOverrides[feature.feature_key];
        const finalFeature = segmentOverride ? segmentOverride.feature : feature;
        const hasOverride = !!segmentOverride;

        const { value: evaluatedValue, reason: evaluatedReason } = hasOverride
            ? { value: finalFeature.value, reason: undefined }
            : evaluateFeatureValue(finalFeature, context.identity?.key);

        flags.push({
            feature_key: finalFeature.feature_key,
            name: finalFeature.name,
            enabled: finalFeature.enabled,
            value: evaluatedValue,
            reason:
                evaluatedReason ??
                getTargetingMatchReason({ type: 'SEGMENT', override: segmentOverride })
        });
    }

    return flags;
}

function evaluateFeatureValue(
    feature: FeatureContext,
    identityKey?: string
): { value: any; reason?: string } {
    if (!!feature.variants && feature.variants.length > 0 && !!identityKey) {
        return getMultivariateFeatureValue(feature, identityKey);
    }

    return { value: feature.value, reason: undefined };
}

/**
 * Evaluates a multivariate feature flag to determine which variant value to return for a given identity.
 *
 * Uses deterministic hashing to ensure the same identity always receives the same variant,
 * while distributing variants according to their configured weight percentages.
 *
 * @param feature - The feature context containing variants and their weights
 * @param identityKey - The identity key used for deterministic variant selection
 * @returns The variant value if the identity falls within a variant's range, otherwise the default feature value
 */
function getMultivariateFeatureValue(
    feature: FeatureContext,
    identityKey?: string
): { value: any; reason?: string } {
    const percentageValue = getHashedPercentageForObjIds([feature.key, identityKey]);

    let startPercentage = 0;
    for (const variant of feature?.variants || []) {
        const limit = startPercentage + variant.weight;

        if (startPercentage <= percentageValue && percentageValue < limit) {
            return {
                value: variant.value,
                reason: getTargetingMatchReason({ type: 'SPLIT', weight: variant.weight })
            };
        }
        startPercentage = limit;
    }
    return { value: feature.value, reason: undefined };
}

export function shouldApplyOverride(
    override: any,
    existingOverrides: Record<string, SegmentOverride>
): boolean {
    const currentOverride = existingOverrides[override.feature_key];
    return (
        !currentOverride || isHigherPriority(override.priority, currentOverride.feature.priority)
    );
}

export function isHigherPriority(
    priorityA: number | undefined,
    priorityB: number | undefined
): boolean {
    return (priorityA ?? Infinity) < (priorityB ?? Infinity);
}

export type TargetingMatchReason =
    | {
          type: 'SEGMENT';
          override: SegmentOverride;
      }
    | {
          type: 'SPLIT';
          weight: number;
      };

const getTargetingMatchReason = (matchObject: TargetingMatchReason) => {
    const { type } = matchObject;

    if (type === 'SEGMENT') {
        return matchObject.override
            ? `${TARGETING_REASONS.TARGETING_MATCH}; segment=${matchObject.override.segmentName}`
            : TARGETING_REASONS.DEFAULT;
    }

    if (type === 'SPLIT') {
        return `${TARGETING_REASONS.SPLIT}; weight=${matchObject.weight}`;
    }

    return TARGETING_REASONS.DEFAULT;
};
