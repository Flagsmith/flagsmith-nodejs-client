import {
    EvaluationContextWithMetadata,
    EvaluationResultSegments,
    EvaluationResultWithMetadata,
    FeatureContextWithMetadata,
    SDKFeatureMetadata,
    FlagResultWithMetadata,
    GenericEvaluationContext
} from './evaluation/models.js';
import { isContextInSegment } from './segments/evaluators.js';
import { EvaluationResultFlags } from './evaluation/models.js';
import { CIRCULAR_DEPENDENCY_REASON, TARGETING_REASONS } from './features/types.js';
import { getHashedPercentageForObjIds } from './utils/hashing/index.js';
export { EnvironmentModel } from './environments/models.js';
export { IdentityModel } from './identities/models.js';
export { TraitModel } from './identities/traits/models.js';
export { SegmentModel } from './segments/models.js';
export { FeatureModel, FeatureStateModel } from './features/models.js';
export { OrganisationModel } from './organisations/models.js';

type SegmentOverride = {
    feature: FeatureContextWithMetadata<SDKFeatureMetadata>;
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
 * Segment conditions may read other flags' evaluated results through `$.flags.<feature>.enabled`,
 * `$.flags.<feature>.value` or `$.flags.<feature>.variant`. Flags caught in a dependency cycle
 * serve their environment default with the reason {@link CIRCULAR_DEPENDENCY_REASON}.
 *
 * @param context - EvaluationContext containing environment, identity, and segment data
 * @returns EvaluationResult with flags, segments, and original context
 */
export function getEvaluationResult(
    context: EvaluationContextWithMetadata
): EvaluationResultWithMetadata {
    const flagDependencies = new FlagDependencies(getEnrichedContext(context));
    const { segments, segmentOverrides } = evaluateSegments(
        flagDependencies.context,
        flagDependencies
    );
    const flags = evaluateFeatures(flagDependencies.context, segmentOverrides);

    if (flagDependencies.used) {
        Object.assign(flags, flagDependencies.resolved);
        for (const featureName of flagDependencies.cyclic) {
            const flag = flags[featureName];
            if (flag) flag.reason = CIRCULAR_DEPENDENCY_REASON;
        }
    }

    return { flags, segments };
}

function getEnrichedContext(context: EvaluationContextWithMetadata): EvaluationContextWithMetadata {
    const identityKey = getIdentityKey(context);
    if (!identityKey) return context;

    return {
        ...context,
        ...(context.identity && {
            identity: {
                identifier: context.identity.identifier,
                key: identityKey,
                traits: context.identity.traits || {}
            }
        })
    };
}

/**
 * Evaluates which segments the context belongs to and collects feature overrides.
 *
 * When multiple segments override the same feature, the segment with
 * higher priority (lower numeric value) takes precedence.
 *
 * @param context - EvaluationContext containing identity and segment definitions
 * @param flagDependencies - Flags read by segment conditions, if the context exposes them
 * @returns Object containing segments the context belongs to and any feature overrides
 */
export function evaluateSegments(
    context: EvaluationContextWithMetadata,
    flagDependencies?: FlagDependencies
): {
    segments: EvaluationResultSegments;
    segmentOverrides: Record<string, SegmentOverride>;
} {
    const segments: EvaluationResultSegments = [];
    const segmentOverrides: Record<string, SegmentOverride> = {};

    for (const [segmentKey, segment] of Object.entries(context.segments || {})) {
        const matches = flagDependencies
            ? flagDependencies.matchesSegment(segmentKey)
            : isContextInSegment(context, segment);
        if (!matches) continue;

        segments.push({
            name: segment.name,
            ...(segment.metadata ? { metadata: { ...segment.metadata } } : {})
        });

        for (const override of segment.overrides || []) {
            if (shouldApplyOverride(override, segmentOverrides)) {
                segmentOverrides[override.name] = {
                    feature: override as FeatureContextWithMetadata<SDKFeatureMetadata>,
                    segmentName: segment.name
                };
            }
        }
    }

    return { segments, segmentOverrides };
}

/**
 * Evaluates all features in the context, applying segment overrides where applicable.
 * For each feature:
 * - Checks if a segment override exists
 * - Uses override values if present, otherwise evaluates the base feature
 * - Determines appropriate evaluation reason
 * - Handles multivariate evaluation
 *
 * @param context - EvaluationContext containing features and identity
 * @param segmentOverrides - Map of feature keys to their segment overrides
 * @returns EvaluationResultFlags containing evaluated flag results
 */
export function evaluateFeatures(
    context: EvaluationContextWithMetadata,
    segmentOverrides: Record<string, SegmentOverride>
): EvaluationResultFlags<SDKFeatureMetadata> {
    const flags: EvaluationResultFlags<SDKFeatureMetadata> = {};
    const targetedFeatureNames = getTargetedFeatureNames(context);

    for (const feature of Object.values(context.features || {})) {
        const segmentOverride = segmentOverrides[feature.name];
        flags[feature.name] = segmentOverride
            ? getFlagResult(
                  context,
                  segmentOverride.feature,
                  getTargetingMatchReason(segmentOverride.segmentName)
              )
            : getFlagResult(
                  context,
                  feature,
                  getFallbackReason(feature.name, targetedFeatureNames)
              );
    }

    return flags;
}

/**
 * Names of the features overridden by at least one segment.
 */
function getTargetedFeatureNames(context: EvaluationContextWithMetadata): Set<string> {
    const targetedFeatureNames = new Set<string>();
    for (const segment of Object.values(context.segments || {})) {
        for (const override of segment.overrides || []) {
            targetedFeatureNames.add(override.name);
        }
    }
    return targetedFeatureNames;
}

/**
 * Reason for a flag evaluated to its environment default: `DEFAULT` if the feature has
 * targeting rules that did not match, `STATIC` if it has none.
 */
function getFallbackReason(
    featureName: string,
    targetedFeatureNames: { has(featureName: string): boolean }
): string {
    return targetedFeatureNames.has(featureName)
        ? TARGETING_REASONS.DEFAULT
        : TARGETING_REASONS.STATIC;
}

function getTargetingMatchReason(segmentName: string): string {
    return `${TARGETING_REASONS.TARGETING_MATCH}; segment=${segmentName}`;
}

/**
 * Evaluates a feature to a flag result, selecting a multivariate variant for identities.
 *
 * Uses deterministic hashing to ensure the same identity always receives the same variant,
 * while distributing variants according to their configured weight percentages.
 *
 * @param context - The evaluation context, providing the identity key
 * @param feature - The feature context, or the segment override, to evaluate
 * @param reason - The reason to report when no variant is selected
 * @returns The flag result
 */
function getFlagResult(
    context: EvaluationContextWithMetadata,
    feature: FeatureContextWithMetadata<SDKFeatureMetadata>,
    reason: string
): FlagResultWithMetadata<SDKFeatureMetadata> {
    const identityKey = getIdentityKey(context);
    let value = feature.value;
    let variant: string | null = null;

    if (identityKey && feature.variants && feature.variants.length > 0) {
        variant = 'control';
        const percentageValue = getHashedPercentageForObjIds([feature.key, identityKey]);
        const sortedVariants = [...feature.variants].sort((a, b) => {
            const aPriority = a.priority ?? Infinity;
            const bPriority = b.priority ?? Infinity;
            if (aPriority < bPriority) return -1;
            if (aPriority > bPriority) return 1;
            return 0;
        });

        let startPercentage = 0;
        for (const featureVariant of sortedVariants) {
            const limit = startPercentage + featureVariant.weight;
            if (startPercentage <= percentageValue && percentageValue < limit) {
                value = featureVariant.value;
                variant = featureVariant.key ?? null;
                reason = `${TARGETING_REASONS.SPLIT}; weight=${featureVariant.weight}`;
                break;
            }
            startPercentage = limit;
        }
    }

    return {
        name: feature.name,
        enabled: feature.enabled,
        value,
        reason,
        variant,
        ...(feature.metadata ? { metadata: feature.metadata } : {})
    } as FlagResultWithMetadata<SDKFeatureMetadata>;
}

export function shouldApplyOverride(
    override: { name: string; priority?: number },
    existingOverrides: Record<string, SegmentOverride>
): boolean {
    const currentOverride = existingOverrides[override.name];
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

/**
 * The `$.flags` mapping of an evaluation context, resolving a flag when a segment condition
 * first reads it, transitively and with a guard against dependency cycles.
 */
export class FlagDependencies {
    /** Flags resolved so far. */
    readonly resolved: EvaluationResultFlags<SDKFeatureMetadata> = {};
    /** Names of the flags found to be in a dependency cycle. */
    readonly cyclic = new Set<string>();
    /** Whether a segment condition has read a flag. */
    used = false;
    /** Number of cycles cut. A segment whose evaluation changes it must not match. */
    cycleHits = 0;
    /** The evaluation context, exposing the `$.flags` mapping to segment conditions. */
    readonly context: EvaluationContextWithMetadata;

    private readonly resolving: string[] = [];
    private readonly segmentMatches = new Map<string, boolean>();
    private segmentKeysByFeatureName?: Map<string, string[]>;

    constructor(context: EvaluationContextWithMetadata) {
        const flags = new Proxy(this.resolved, {
            get: (target, property) =>
                this.read(property) ? Reflect.get(target, property) : undefined,
            getOwnPropertyDescriptor: (target, property) =>
                this.read(property) ? Reflect.getOwnPropertyDescriptor(target, property) : undefined
        });
        this.context = { ...context, flags };
    }

    private read(property: string | symbol): boolean {
        if (typeof property !== 'string') return false;
        if (!hasOwn(this.resolved, property)) {
            this.used = true;
            this.resolveFeature(property);
        }
        return hasOwn(this.resolved, property);
    }

    private resolveFeature(featureName: string): void {
        const cycleStart = this.resolving.indexOf(featureName);
        if (cycleStart !== -1) {
            for (const name of this.resolving.slice(cycleStart)) this.cyclic.add(name);
            this.cycleHits++;
            return;
        }
        const features = this.context.features || {};
        if (!hasOwn(features, featureName)) return;
        const feature = features[featureName];

        this.resolving.push(featureName);
        let segmentOverride: SegmentOverride | undefined;
        try {
            segmentOverride = this.getSegmentOverride(featureName);
        } finally {
            this.resolving.pop(); // Errors are swallowed by JSONPath evaluation
        }

        if (this.cyclic.has(featureName)) return;

        this.resolved[featureName] = segmentOverride
            ? getFlagResult(
                  this.context,
                  segmentOverride.feature,
                  getTargetingMatchReason(segmentOverride.segmentName)
              )
            : getFlagResult(
                  this.context,
                  feature,
                  getFallbackReason(featureName, this.getSegmentKeysByFeatureName())
              );
    }

    /**
     * Whether the context belongs to a segment. A segment matching, or not, on a flag in a
     * dependency cycle does not match.
     */
    matchesSegment(segmentKey: string): boolean {
        const memoised = this.used ? this.segmentMatches.get(segmentKey) : undefined;
        if (memoised !== undefined) return memoised;

        const cycleHits = this.cycleHits;
        const matches = isContextInSegment(this.context, this.context.segments![segmentKey]);
        if (this.cycleHits !== cycleHits) return false; // Matched or not on an unresolvable flag

        if (this.used) this.segmentMatches.set(segmentKey, matches);
        return matches;
    }

    private getSegmentOverride(featureName: string): SegmentOverride | undefined {
        const segmentOverrides: Record<string, SegmentOverride> = {};

        for (const segmentKey of this.getSegmentKeysByFeatureName().get(featureName) || []) {
            if (!this.matchesSegment(segmentKey)) continue;
            const segment = this.context.segments![segmentKey];
            for (const override of segment.overrides || []) {
                if (override.name !== featureName) continue;
                if (shouldApplyOverride(override, segmentOverrides)) {
                    segmentOverrides[featureName] = {
                        feature: override as FeatureContextWithMetadata<SDKFeatureMetadata>,
                        segmentName: segment.name
                    };
                }
            }
        }

        return segmentOverrides[featureName];
    }

    private getSegmentKeysByFeatureName(): Map<string, string[]> {
        if (!this.segmentKeysByFeatureName) {
            this.segmentKeysByFeatureName = new Map();
            for (const [segmentKey, segment] of Object.entries(this.context.segments || {})) {
                for (const override of segment.overrides || []) {
                    const segmentKeys = this.segmentKeysByFeatureName.get(override.name) || [];
                    segmentKeys.push(segmentKey);
                    this.segmentKeysByFeatureName.set(override.name, segmentKeys);
                }
            }
        }
        return this.segmentKeysByFeatureName;
    }
}

const hasOwn = (object: object, property: string): boolean =>
    Object.prototype.hasOwnProperty.call(object, property);

const getIdentityKey = (context: GenericEvaluationContext): string | undefined => {
    if (!context.identity) return undefined;
    return context.identity.key || `${context.environment.key}_${context.identity?.identifier}`;
};
