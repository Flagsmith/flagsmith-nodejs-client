declare module 'flagsmith-nodejs' {
    /**
     * Initialise the sdk against a particular environment
     */
    export function init(config: {
        environmentID: string;
        onError?: Function;
        defaultFlags?: string[];
        api?: string;
    }): void;

    /**
     * Get the whether a flag is enabled e.g. flagsmith.hasFeature("powerUserFeature")
     */
    export function hasFeature(key: string): Promise<boolean>;

    /**
     * Get the value of a whether a flag is enabled for a user e.g. flagsmith.hasFeature("powerUserFeature", 1234)
     */
    export function hasFeature(key: string, userId: string): Promise<boolean>;

    /**
     * Get the value of a particular remote config e.g. flagsmith.getValue("font_size")
     */
    export function getValue(key: string): Promise<string | number | boolean>;

    /**
     * Get the value of a particular remote config for a specified user e.g. flagsmith.getValue("font_size", 1234)
     */
    export function getValue(key: string, userId: string): Promise<string | number | boolean>;

    /**
     * Trigger a manual fetch of the environment features
     */
    export function getFlags(): Promise<IFlags>;

    /**
     * Trigger a manual fetch of the environment features for a given user id
     */
    export function getFlagsForUser(userId: string): Promise<IFlags>;

    /**
     * Trigger a manual fetch of both the environment features and users' traits for a given user id
     */
    export function getUserIdentity(userId: string): Promise<IUserIdentity>;

    /**
     * Trigger a manual fetch of a specific trait for a given user id
     */
    export function getTrait(userId: string, key: string): Promise<ITraits>;

    /**
     * Set a specific trait for a given user id
     */
    export function setTrait(
        userId: string,
        key: string,
        value: string | number | boolean
    ): IUserIdentity;

    interface IFeature {
        enabled: boolean;
        value?: string | number | boolean;
    }

    interface IFlags {
        [key: string]: IFeature;
    }

    interface ITraits {
        [key: string]: string;
    }

    interface IUserIdentity {
        flags: IFeature;
        traits: ITraits;
    }
}
