import type { EvaluationContext } from '../evaluationContext/models.ts';

import type {
    EvaluationResult as EvaluationContextResult,
    FlagResult as EvaluationContextResultFlagResult,
    SegmentResult,
    SegmentCondition,
    IdentityContext,
    SegmentContext,
    EnvironmentContext
} from './evaluationResult.types.ts';

export type EnvironmentKey = EnvironmentContext['key'];
export type EnvironmentName = EnvironmentContext['name'];

export type IdentityIdentifier = IdentityContext['identifier'];
export type IdentityKey = IdentityContext['key'];

export type SegmentKey = SegmentResult['key'];
export type SegmentName = SegmentResult['name'];
export type SegmentConditionOperator = SegmentCondition['operator'];
export type SegmentRuleType = SegmentContext['rules'][0]['type'];

export type FeatureKey = EvaluationContextResultFlagResult['feature_key'];
export type FeatureName = EvaluationContextResultFlagResult['name'];
export type FeatureEnabled = EvaluationContextResultFlagResult['enabled'];
export type FeatureValue = EvaluationContextResultFlagResult['value'];
export type EvaluationReason = EvaluationContextResultFlagResult['reason'];

export type EvaluationResultSegments = EvaluationContextResult['segments'];
export type EvaluationResultFlags = {
    feature_key: FeatureKey;
    name: FeatureName;
    enabled: FeatureEnabled;
    value: FeatureValue;
    reason: EvaluationReason;
}[];

export type EvaluationResult = {
    context: EvaluationContext;
    flags: EvaluationResultFlags;
    segments: EvaluationResultSegments;
};
