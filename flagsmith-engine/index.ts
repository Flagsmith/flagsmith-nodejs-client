import { EvaluationContext, FeatureContext } from './evaluationContext/models.js';
import { getIdentitySegments } from './segments/evaluators.js';
import { EvaluationResult, EvaluationResultFlags } from './evaluationResult/models.js';
import { evaluateFeatureValue } from './features/util.js';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from './segments/constants.js';
import { TARGETING_REASONS } from './features/types.js';
export { EnvironmentModel } from './environments/models.js';
export { IdentityModel } from './identities/models.js';
export { TraitModel } from './identities/traits/models.js';
export { SegmentModel } from './segments/models.js';
// 1. Mappers => Env/identities/segments => EvaluationContext
// 2. One entrypoint => getEvaluationResult
// 3. All these must be disappear

type segmentOverride = {
    feature: FeatureContext;
    segmentName: string;
};

export function getEvaluationResult(context: EvaluationContext): EvaluationResult {
    const segments: EvaluationResult['segments'] = [];
    const segmentOverrides: Record<string, segmentOverride> = {};
    const DEFAULT_PRIORITY = Infinity;

    if (context.identity && context.segments) {
        const identitySegments = getIdentitySegments(context);

        for (const segment of identitySegments) {
            segments.push({ key: segment.key, name: segment.name });

            if (segment.overrides) {
                const overridesList = Array.isArray(segment.overrides) ? segment.overrides : [];
                for (const override of overridesList) {
                    const currentOverride = segmentOverrides[override.feature_key];
                    if (
                        !currentOverride ||
                        (override.priority ?? DEFAULT_PRIORITY) <
                            (currentOverride.feature.priority ?? DEFAULT_PRIORITY)
                    ) {
                        segmentOverrides[override.feature_key] = {
                            feature: override,
                            segmentName: segment.name
                        };
                    }
                }
            }
        }
    }

    const flags: EvaluationResultFlags = [];
    for (const feature of Object.values(context.features || {})) {
        const segmentOverride = segmentOverrides[feature.feature_key];
        const finalFeature = segmentOverride ? segmentOverride.feature : feature;
        const reason = getTargetingMatchReason(segmentOverride, segmentOverride?.segmentName);
        const hasOverride = !!segmentOverride;

        flags.push({
            feature_key: finalFeature.feature_key,
            name: finalFeature.name,
            enabled: finalFeature.enabled,
            value: hasOverride
                ? finalFeature.value
                : evaluateFeatureValue(finalFeature, context.identity?.key),
            reason
        });
    }

    // Not sure if we need this - Keeping till confirmed hidedisabledflags is remote evaluation only
    // const filteredFlags = hideDisabledFlags ? flags.filter(flag => flag.enabled) : flags;

    return { context, flags, segments };
}

const getTargetingMatchReason = (segmentOverride: segmentOverride) => {
    if (segmentOverride) {
        return segmentOverride.segmentName === IDENTITY_OVERRIDE_SEGMENT_NAME
            ? TARGETING_REASONS.IDENTITY_OVERRIDE
            : `${TARGETING_REASONS.TARGETING_MATCH}; segment=${segmentOverride.segmentName}`;
    }
    return TARGETING_REASONS.DEFAULT;
};
