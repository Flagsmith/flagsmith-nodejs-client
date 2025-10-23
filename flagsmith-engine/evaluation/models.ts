// This file is the entry point for the evaluation module types
// All types from evaluations should be at least imported here and re-exported
// Do not use types directly from generated files

import type {
    EvaluationResult as EvaluationContextResult,
    FlagResult,
    FeatureMetadata,
    SegmentMetadata
} from './evaluationResult/evaluationResult.types.js';

import type {
    FeatureContext,
    EnvironmentContext,
    IdentityContext,
    Segments,
    SegmentContext
} from './evaluationContext/evaluationContext.types.js';

export interface CustomFeatureMetadata extends FeatureMetadata {
    flagsmith_id: number;
}

export interface CustomSegmentMetadata extends SegmentMetadata {
    flagsmith_id: number;
    source?: SegmentSource;
}

export interface FeatureContextWithMetadata<T extends FeatureMetadata = FeatureMetadata>
    extends FeatureContext {
    metadata: T;
    [k: string]: unknown;
}

export type FeaturesWithMetadata<T extends FeatureMetadata = FeatureMetadata> = {
    [k: string]: FeatureContextWithMetadata<T>;
};

export interface SegmentContextWithMetadata<T extends SegmentMetadata = SegmentMetadata>
    extends SegmentContext {
    metadata: T;
    overrides?: FeatureContextWithMetadata<FeatureMetadata>[];
}

export type SegmentsWithMetadata<T extends SegmentMetadata = SegmentMetadata> = {
    [k: string]: SegmentContextWithMetadata<T>;
};

export interface GenericEvaluationContext<
    T extends FeatureMetadata = FeatureMetadata,
    S extends SegmentMetadata = SegmentMetadata
> {
    environment: EnvironmentContext;
    identity?: IdentityContext | null;
    segments?: SegmentsWithMetadata<S>;
    features?: FeaturesWithMetadata<T>;
    [k: string]: unknown;
}

export type FlagResultWithMetadata<T extends FeatureMetadata = FeatureMetadata> = FlagResult & {
    metadata: T;
};

export type EvaluationResultFlags<T extends FeatureMetadata = FeatureMetadata> = Record<
    string,
    FlagResultWithMetadata<T>
>;

export type EvaluationResultSegments = EvaluationContextResult['segments'];

export type EvaluationResult<T extends FeatureMetadata = FeatureMetadata> = {
    flags: EvaluationResultFlags<T>;
    segments: EvaluationResultSegments;
};

export type EvaluationResultWithMetadata = EvaluationResult<CustomFeatureMetadata>;
export type EvaluationContextWithMetadata = GenericEvaluationContext<
    CustomFeatureMetadata,
    CustomSegmentMetadata
>;

export interface SegmentResultWithMetadata {
    name: string;
    metadata: CustomSegmentMetadata;
}

export enum SegmentSource {
    API = 'api',
    IDENTITY_OVERRIDE = 'identity_override'
}

export * from './evaluationContext/evaluationContext.types.js';
