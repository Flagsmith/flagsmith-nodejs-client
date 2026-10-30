import {
    EvaluationContextWithMetadata,
    EvaluationResultSegments,
    EvaluationResultWithMetadata,
    FeatureContextWithMetadata,
    SDKFeatureMetadata,
    FlagResultWithMetadata,
    GenericEvaluationContext,
    SDKSegmentMetadata,
    SegmentContextWithMetadata
} from './evaluation/models.js';
import { isContextInSegment } from './segments/evaluators.js';
import { EvaluationResultFlags } from './evaluation/models.js';
import type { Variant } from './evaluation/evaluationResult/evaluationResult.types.js';
import { CONTROL_VARIANT } from './features/constants.js';
import { TARGETING_REASONS } from './features/types.js';
import { getHashedPercentageForObjIds } from './utils/hashing/index.js';
export { EnvironmentModel } from './environments/models.js';
export { IdentityModel } from './identities/models.js';
export { TraitModel } from './identities/traits/models.js';
export { SegmentModel } from './segments/models.js';
export { FeatureModel, FeatureStateModel } from './features/models.js';
export { OrganisationModel } from './organisations/models.js';

type SegmentOverride = {
    feature: FeatureContextWithMetadata;
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
export function getEvaluationResult(
    context: EvaluationContextWithMetadata
): EvaluationResultWithMetadata {
    const dependencies = new FlagDependencies(getEnrichedContext(context));
    const { segments, segmentOverrides } = evaluateSegments(dependencies.context, dependencies);
    const flags = evaluateFeatures(dependencies.context, segmentOverrides);

    if (dependencies.used) {
        Object.assign(flags, dependencies.resolved);
        for (const featureName of dependencies.cyclic) {
            if (flags[featureName]) flags[featureName].reason = CIRCULAR_DEPENDENCY_REASON;
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

const CIRCULAR_DEPENDENCY_REASON = 'ERROR; code=CIRCULAR_DEPENDENCY';

/**
 * Resolves the flags that segment conditions read from `$.flags`, as they are first read.
 *
 * Flags supplied with the context are discarded: `$.flags` only ever holds flags resolved here.
 */
export class FlagDependencies {
    /** The evaluation context, with `$.flags` resolving flags as conditions read them. */
    readonly context: EvaluationContextWithMetadata;
    readonly resolved: EvaluationResultFlags<SDKFeatureMetadata> = {};
    /** Names of the flags found to be in a dependency cycle. */
    readonly cyclic = new Set<string>();
    /** Whether any condition read a flag. */
    used = false;
    /** Incremented whenever a cycle is cut, voiding any segment verdict reached meanwhile. */
    cycleHits = 0;

    private readonly resolving: string[] = [];
    private readonly segmentMatches = new Map<string, boolean>();
    private segmentKeysByFeatureName?: Map<string, string[]>;

    constructor(context: EvaluationContextWithMetadata) {
        const resolveOnRead = (featureName: string | symbol) => {
            if (typeof featureName === 'string' && !Object.hasOwn(this.resolved, featureName)) {
                this.used = true;
                this.resolveFeature(featureName);
            }
        };
        const flags = new Proxy(this.resolved, {
            get: (target, featureName) => {
                resolveOnRead(featureName);
                return Reflect.get(target, featureName);
            },
            has: (target, featureName) => {
                resolveOnRead(featureName);
                return Reflect.has(target, featureName);
            },
            getOwnPropertyDescriptor: (target, featureName) => {
                resolveOnRead(featureName);
                return Reflect.getOwnPropertyDescriptor(target, featureName);
            }
        });
        this.context = { ...context, flags };
    }

    private resolveFeature(featureName: string): void {
        const cycleStart = this.resolving.indexOf(featureName);
        if (cycleStart !== -1) {
            this.resolving.slice(cycleStart).forEach(name => this.cyclic.add(name));
            this.cycleHits++;
            return;
        }
        const feature = this.context.features?.[featureName];
        if (!feature) return;

        this.resolving.push(featureName);
        let segmentOverride: SegmentOverride | undefined;
        try {
            segmentOverride = this.getSegmentOverride(featureName);
        } finally {
            this.resolving.pop(); // jsonpath-plus swallows errors, which would otherwise leave a false cycle
        }

        if (this.cyclic.has(featureName)) return;
        this.resolved[featureName] = getFlagResult(this.context, feature, segmentOverride);
    }

    private getSegmentOverride(featureName: string): SegmentOverride | undefined {
        if (!this.segmentKeysByFeatureName) {
            this.segmentKeysByFeatureName = new Map();
            for (const [segmentKey, segment] of Object.entries(this.context.segments || {})) {
                for (const override of segment.overrides || []) {
                    const segmentKeys = this.segmentKeysByFeatureName.get(override.name) || [];
                    this.segmentKeysByFeatureName.set(override.name, [...segmentKeys, segmentKey]);
                }
            }
        }

        let segmentOverride: SegmentOverride | undefined;
        for (const segmentKey of this.segmentKeysByFeatureName.get(featureName) || []) {
            if (!this.matchesSegment(segmentKey)) continue;
            const segment = this.context.segments![segmentKey];
            for (const override of segment.overrides || []) {
                if (
                    override.name === featureName &&
                    (!segmentOverride ||
                        isHigherPriority(override.priority, segmentOverride.feature.priority))
                ) {
                    segmentOverride = { feature: override, segmentName: segment.name };
                }
            }
        }
        return segmentOverride;
    }

    private matchesSegment(segmentKey: string): boolean {
        const memoised = this.segmentMatches.get(segmentKey);
        if (memoised !== undefined) return memoised;

        const cycleHits = this.cycleHits;
        const matches = isContextInSegment(this.context, this.context.segments![segmentKey]);
        if (this.cycleHits !== cycleHits) return false;

        this.segmentMatches.set(segmentKey, matches);
        return matches;
    }
}

/**
 * Evaluates which segments the context belongs to and collects feature overrides.
 *
 * A segment whose evaluation cut a flag dependency cycle is left out, matched or not.
 *
 * @param context - EvaluationContext containing segment definitions
 * @param dependencies - Flag dependencies read by segment conditions, if any
 * @returns Object containing segments the context belongs to and any feature overrides
 */
export function evaluateSegments(
    context: EvaluationContextWithMetadata,
    dependencies?: FlagDependencies
): {
    segments: EvaluationResultSegments;
    segmentOverrides: Record<string, SegmentOverride>;
} {
    const matchedSegments: SegmentContextWithMetadata<SDKSegmentMetadata>[] = [];
    let cycleHits = dependencies?.cycleHits;

    for (const segment of Object.values(context.segments || {})) {
        const matches = isContextInSegment(context, segment);
        if (dependencies && dependencies.cycleHits !== cycleHits) {
            cycleHits = dependencies.cycleHits;
            continue;
        }
        if (matches) matchedSegments.push(segment);
    }

    const segments = matchedSegments.map(segment => ({
        name: segment.name,
        ...(segment.metadata
            ? {
                  metadata: {
                      ...segment.metadata
                  }
              }
            : {})
    })) as EvaluationResultSegments;
    const segmentOverrides = processSegmentOverrides(matchedSegments);

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
                segmentOverrides[override.name] = {
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
    context: EvaluationContextWithMetadata,
    segmentOverrides: Record<string, SegmentOverride>
): EvaluationResultFlags<SDKFeatureMetadata> {
    const flags: EvaluationResultFlags<SDKFeatureMetadata> = {};

    for (const feature of Object.values(context.features || {})) {
        flags[feature.name] = getFlagResult(context, feature, segmentOverrides[feature.name]);
    }

    return flags;
}

function getFlagResult(
    context: EvaluationContextWithMetadata,
    feature: FeatureContextWithMetadata<SDKFeatureMetadata>,
    segmentOverride?: SegmentOverride
): FlagResultWithMetadata<SDKFeatureMetadata> {
    const finalFeature = segmentOverride ? segmentOverride.feature : feature;

    const {
        value: evaluatedValue,
        reason: evaluatedReason,
        variant
    } = evaluateFeatureValue(finalFeature, getIdentityKey(context));

    return {
        name: finalFeature.name,
        enabled: finalFeature.enabled,
        value: evaluatedValue,
        variant,
        ...(finalFeature.metadata ? { metadata: finalFeature.metadata } : {}),
        reason:
            evaluatedReason ??
            getTargetingMatchReason({ type: 'SEGMENT', override: segmentOverride })
    } as FlagResultWithMetadata<SDKFeatureMetadata>;
}

type FeatureValueResult = { value: any; reason?: string; variant: Variant };

function evaluateFeatureValue(
    feature: FeatureContextWithMetadata,
    identityKey?: string
): FeatureValueResult {
    if (!!feature.variants && feature.variants.length > 0 && !!identityKey) {
        return getMultivariateFeatureValue(feature, identityKey);
    }

    return { value: feature.value, reason: undefined, variant: null };
}

/**
 * Evaluates a multivariate feature flag to determine which variant value to return for a given identity.
 *
 * Uses deterministic hashing to ensure the same identity always receives the same variant,
 * while distributing variants according to their configured weight percentages.
 *
 * @param feature - The feature context containing variants and their weights
 * @param identityKey - The identity key used for deterministic variant selection
 * @returns The variant value and key if the identity falls within a variant's range, otherwise the default feature value and the control variant
 */
function getMultivariateFeatureValue(
    feature: FeatureContextWithMetadata,
    identityKey?: string
): FeatureValueResult {
    const percentageValue = getHashedPercentageForObjIds([feature.key, identityKey]);
    const sortedVariants = [...(feature?.variants || [])].sort((a, b) => {
        const aPriority = a.priority ?? Infinity;
        const bPriority = b.priority ?? Infinity;
        if (aPriority < bPriority) return -1;
        if (aPriority > bPriority) return 1;
        return 0;
    });

    let startPercentage = 0;
    for (const variant of sortedVariants) {
        const limit = startPercentage + variant.weight;
        if (startPercentage <= percentageValue && percentageValue < limit) {
            return {
                value: variant.value,
                reason: getTargetingMatchReason({ type: 'SPLIT', weight: variant.weight }),
                variant: variant.key ?? null
            };
        }
        startPercentage = limit;
    }

    return { value: feature.value, reason: undefined, variant: CONTROL_VARIANT };
}

export function shouldApplyOverride(
    override: any,
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

export type TargetingMatchReason =
    | {
          type: 'SEGMENT';
          override?: SegmentOverride;
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

const getIdentityKey = (context: GenericEvaluationContext): string | undefined => {
    if (!context.identity) return undefined;
    return context.identity.key || `${context.environment.key}_${context.identity?.identifier}`;
};
