import { FeatureStateModel } from '../flagsmith-engine/features/models.js';
import { AnalyticsProcessor } from './analytics.js';

type FlagValue = string | number | boolean | undefined;

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

    constructor(params: {
        value: FlagValue;
        enabled: boolean;
        isDefault?: boolean;
        featureId: number;
        featureName: string;
    }) {
        super(params.value, params.enabled, !!params.isDefault);
        this.featureId = params.featureId;
        this.featureName = params.featureName;
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
            featureName: flagData['feature']['name']
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
