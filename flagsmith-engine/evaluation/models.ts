// This file is the entry point for the evaluation module types
// All types from evaluations should be at least imported here and re-exported
// Do not use types directly from generated files

import type {
    EvaluationResult as EvaluationContextResult,
    FlagResult,
    Metadata
} from './evaluationResult/evaluationResult.types.js';

import type {
    EvaluationContext as GeneratedEvaluationContext,
    FeatureContext as GeneratedFeatureContext
} from './evaluationContext/evaluationContext.types.js';

export interface FeatureMetadata extends Metadata {
    flagsmithId: number;
}

export interface FeatureContext<T extends Metadata = Metadata> {
    key: GeneratedFeatureContext['key'];
    feature_key: GeneratedFeatureContext['feature_key'];
    name: GeneratedFeatureContext['name'];
    enabled: GeneratedFeatureContext['enabled'];
    value: GeneratedFeatureContext['value'];
    variants?: GeneratedFeatureContext['variants'];
    priority?: GeneratedFeatureContext['priority'];
    metadata?: T;
    [k: string]: unknown;
}

export type FeaturesWithMetadata<T extends Metadata = Metadata> = {
    [k: string]: FeatureContext<T>;
};

export interface EvaluationContext<T extends Metadata = Metadata> {
    environment: GeneratedEvaluationContext['environment'];
    identity?: GeneratedEvaluationContext['identity'];
    segments?: GeneratedEvaluationContext['segments'];
    features?: FeaturesWithMetadata<T>;
    [k: string]: unknown;
}

export type FlagResultWithMetadata<T extends Metadata = Metadata> = FlagResult & {
    metadata?: T;
};

export type EvaluationResultFlags<T extends Metadata = Metadata> = Record<
    string,
    FlagResultWithMetadata<T>
>;

export type EvaluationResultSegments = EvaluationContextResult['segments'];

export type EvaluationResult<T extends Metadata = Metadata> = {
    flags: EvaluationResultFlags<T>;
    segments: EvaluationResultSegments;
};

export type EvaluationResultWithMetadata = EvaluationResult<FeatureMetadata>;
export type EvaluationContextWithMetadata = EvaluationContext<FeatureMetadata>;

export enum SegmentSource {
    API = 'api',
    IDENTITY_OVERRIDE = 'identity_override'
}

export * from './evaluationContext/evaluationContext.types.js';
