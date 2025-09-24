// This file is the entry point for the evaluation module types
// All types from evaluations should be at least imported here and re-exported
// Do not use types directly from generated files

import type {
    EnvironmentContext,
    IdentityContext,
    SegmentContext,
    SegmentRule,
    SegmentCondition,
    InSegmentCondition,
    FeatureContext,
    FeatureValue as ContextFeatureValue,
    Traits,
    Features,
    Segments,
    EvaluationContext
} from './evaluationContext/evaluationContext.types.js';

import type {
    EvaluationResult as EvaluationContextResult,
    FlagResult as EvaluationContextResultFlagResult
} from './evaluationResult/evaluationResult.types.js';

export type EnvironmentKey = EnvironmentContext['key'];
export type EnvironmentName = EnvironmentContext['name'];

export type IdentityIdentifier = IdentityContext['identifier'];
export type IdentityKey = IdentityContext['key'];

export type SegmentKey = SegmentContext['key'];
export type SegmentName = SegmentContext['name'];
export type SegmentRuleType = SegmentRule['type'];
export type ConditionOperator = SegmentCondition['operator'] | InSegmentCondition['operator'];
export type ConditionProperty = SegmentCondition['property'] | InSegmentCondition['property'];
export type ConditionValue = SegmentCondition['value'] | InSegmentCondition['value'];

export type FeatureKey = FeatureContext['feature_key'];
export type FeatureName = FeatureContext['name'];
export type FeatureEnabled = FeatureContext['enabled'];
export type FeatureValue = FeatureContext['value'];
export type FeaturePriority = FeatureContext['priority'];
export type FeatureVariants = FeatureContext['variants'];

export type VariantValue = ContextFeatureValue['value'];
export type VariantWeight = ContextFeatureValue['weight'];

export type TraitMap = Traits;
export type FeatureMap = Features;
export type SegmentMap = Segments;

export type SegmentConditionOperator = SegmentCondition['operator'];

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

export type { FlagResult } from './evaluationResult/evaluationResult.types.js';
export type * from './evaluationContext/evaluationContext.types.js';
