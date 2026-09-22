import {
    SDKFeatureMetadata,
    FlagResultWithMetadata,
    EvaluationResultWithMetadata
} from '../flagsmith-engine/evaluation/models.js';
import { FeatureStateModel } from '../flagsmith-engine/features/models.js';
import { AnalyticsProcessor } from './analytics.js';

type FlagValue = string | number | boolean | undefined | null;

/**
 * A Flagsmith feature. It has an enabled/disabled state, and an optional {@link FlagValue}.
 */
export class BaseFlag {
    /**
     * Indicates whether this feature is enabled.
     */
    enabled: boolean;
    /**
     * An optional {@link FlagValue} for this feature.
     */
    value: FlagValue;
    /**
     * If true, the state for this feature was determined by a default flag handler. See {@link DefaultFlag}.
     */
    isDefault: boolean;

    constructor(value: FlagValue, enabled: boolean, isDefault: boolean) {
        this.value = value;
        this.enabled = enabled;
        this.isDefault = isDefault;
    }
}

/**
 * A {@link BaseFlag} returned by a default flag handler when flag evaluation fails.
 * @see FlagsmithConfig#defaultFlagHandler
 */
export class DefaultFlag extends BaseFlag {
    constructor(value: FlagValue, enabled: boolean) {
        super(value, enabled, true);
    }
}

/**
 * A running experiment on a feature, as reported by a remote identity evaluation.
 */
export class ExperimentMetadata {
    /**
     * An identifier for this experiment, unique in a single Flagsmith installation.
     */
    id: number;
    /**
     * The name of this experiment, as shown in the Flagsmith dashboard.
     */
    name: string;
    /**
     * Whether this identity is enrolled in the experiment. A {@link Flag.variant} alone cannot tell:
     * an identity outside the experiment's rollout is still bucketed into a variant.
     */
    inExperiment: boolean;

    constructor(params: { id: number; name: string; inExperiment: boolean }) {
        this.id = params.id;
        this.name = params.name;
        this.inExperiment = params.inExperiment;
    }

    /**
     * Build an {@link ExperimentMetadata} from the `metadata` object of an API flag.
     *
     * @param metadata The `metadata` value of an API flag. Keys other than `experiment` are ignored.
     * @returns `undefined` if no usable experiment is present.
     */
    static fromAPIMetadata(metadata: unknown): ExperimentMetadata | undefined {
        if (!metadata || typeof metadata !== 'object') {
            return undefined;
        }
        const experiment = (metadata as { [key: string]: any })['experiment'];
        if (!experiment || typeof experiment !== 'object') {
            return undefined;
        }
        const id = experiment['id'];
        const name = experiment['name'];
        if (id === undefined || id === null || name === undefined || name === null) {
            return undefined;
        }
        return new ExperimentMetadata({
            id: id,
            name: name,
            inExperiment: !!experiment['in_experiment']
        });
    }
}

/**
 * A Flagsmith feature retrieved from a successful flag evaluation.
 */
export class Flag extends BaseFlag {
    /**
     * An identifier for this feature, unique in a single Flagsmith installation.
     */
    featureId: number;
    /**
     * The programmatic name for this feature, unique per Flagsmith project.
     */
    featureName: string;
    /**
     * The reason for this feature, unique per Flagsmith project.
     */
    reason?: string;
    /**
     * The variant key this identity was bucketed into. Set by remote evaluation only.
     */
    variant?: string;
    /**
     * The experiment running on this feature, if any. Set by remote identity evaluation only.
     */
    experiment?: ExperimentMetadata;

    constructor(params: {
        value: FlagValue;
        enabled: boolean;
        isDefault?: boolean;
        featureId: number;
        featureName: string;
        reason?: string;
        variant?: string;
        experiment?: ExperimentMetadata;
    }) {
        super(params.value, params.enabled, !!params.isDefault);
        this.featureId = params.featureId;
        this.featureName = params.featureName;
        this.reason = params.reason;
        this.variant = params.variant;
        this.experiment = params.experiment;
    }

    static fromFeatureStateModel(
        fsm: FeatureStateModel,
        identityId: number | string | undefined
    ): Flag {
        return new Flag({
            value: fsm.getValue(identityId),
            enabled: fsm.enabled,
            featureId: fsm.feature.id,
            featureName: fsm.feature.name
        });
    }

    static fromAPIFlag(flagData: any): Flag {
        return new Flag({
            enabled: flagData['enabled'],
            value: flagData['feature_state_value'] ?? flagData['value'],
            featureId: flagData['feature']['id'],
            featureName: flagData['feature']['name'],
            reason: flagData['reason'],
            variant: flagData['variant'],
            experiment: ExperimentMetadata.fromAPIMetadata(flagData['metadata'])
        });
    }
}

export class Flags {
    flags: { [key: string]: Flag } = {};
    defaultFlagHandler?: (featureName: string) => DefaultFlag;
    analyticsProcessor?: AnalyticsProcessor;

    constructor(data: {
        flags: { [key: string]: Flag };
        defaultFlagHandler?: (v: string) => DefaultFlag;
        analyticsProcessor?: AnalyticsProcessor;
    }) {
        this.flags = data.flags;
        this.defaultFlagHandler = data.defaultFlagHandler;
        this.analyticsProcessor = data.analyticsProcessor;
    }

    static fromEvaluationResult(
        evaluationResult: EvaluationResultWithMetadata,
        defaultFlagHandler?: (v: string) => DefaultFlag,
        analyticsProcessor?: AnalyticsProcessor
    ): Flags {
        const flags: { [key: string]: Flag } = {};
        for (const flag of Object.values(evaluationResult.flags)) {
            const flagMetadataId = flag.metadata?.id;
            if (!flagMetadataId) {
                throw new Error(
                    `FlagResult metadata.id is missing for feature "${flag.name}". ` +
                        `This indicates a bug in the SDK, please report it.`
                );
            }

            flags[flag.name] = new Flag({
                enabled: flag.enabled,
                value: flag.value ?? null,
                featureId: flagMetadataId,
                featureName: flag.name,
                reason: flag.reason
            });
        }
        return new Flags({
            flags: flags,
            defaultFlagHandler: defaultFlagHandler,
            analyticsProcessor: analyticsProcessor
        });
    }

    static fromFeatureStateModels(data: {
        featureStates: FeatureStateModel[];
        analyticsProcessor?: AnalyticsProcessor;
        defaultFlagHandler?: (f: string) => DefaultFlag;
        identityID?: string | number;
    }): Flags {
        const flags: { [key: string]: Flag } = {};
        for (const fs of data.featureStates) {
            flags[fs.feature.name] = Flag.fromFeatureStateModel(fs, data.identityID);
        }
        return new Flags({
            flags: flags,
            defaultFlagHandler: data.defaultFlagHandler,
            analyticsProcessor: data.analyticsProcessor
        });
    }

    static fromAPIFlags(data: {
        apiFlags: { [key: string]: any }[];
        analyticsProcessor?: AnalyticsProcessor;
        defaultFlagHandler?: (v: string) => DefaultFlag;
    }): Flags {
        const flags: { [key: string]: Flag } = {};

        for (const flagData of data.apiFlags) {
            flags[flagData['feature']['name']] = Flag.fromAPIFlag(flagData);
        }

        return new Flags({
            flags: flags,
            defaultFlagHandler: data.defaultFlagHandler,
            analyticsProcessor: data.analyticsProcessor
        });
    }

    allFlags(): Flag[] {
        return Object.values(this.flags);
    }

    getFlag(featureName: string): BaseFlag {
        const flag = this.flags[featureName];

        if (!flag) {
            if (this.defaultFlagHandler) {
                return this.defaultFlagHandler(featureName);
            }

            return { enabled: false, isDefault: true, value: undefined };
        }

        if (this.analyticsProcessor && flag.featureId) {
            this.analyticsProcessor.trackFeature(flag.featureName);
        }

        return flag;
    }

    getFeatureValue(featureName: string): FlagValue {
        return this.getFlag(featureName).value;
    }

    isFeatureEnabled(featureName: string): boolean {
        return this.getFlag(featureName).enabled;
    }
}
