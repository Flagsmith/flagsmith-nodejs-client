declare module 'bullet-train-nodejs' {
    /**
     * Initialise the sdk against a particular environment
     */
    export function init(config: {
        environmentID: string
        onError?: Function
        defaultFlags?: string[]
        api?: string
    }): void

    /**
     * Get the value of a particular feature e.g. bulletTrain.hasFeature("powerUserFeature")
     */
    export function hasFeature(key: string): Promise<boolean>

    /**
     * Get the value of a particular feature for a user e.g. bulletTrain.hasFeature("powerUserFeature", 1234)
     */
    export function hasFeature(key: string, userId: string): Promise<boolean>

    /**
     * Get the value of a particular feature e.g. bulletTrain.getValue("font_size")
     */
    export function getValue(key: string): Promise<string>

    /**
     * Get the value of a particular feature for a specificed user e.g. bulletTrain.getValue("font_size", 1234)
     */
    export function getValue(key: string, userId: string): Promise<string>

    /**
     * Trigger a manual fetch of the environment features
     */
    export function getFlags(): Promise<IFlags>

    /**
     * Trigger a manual fetch of the environment features for a given user id
     */
    export function getFlagsForUser(userId: string): Promise<IFlags>

    /**
     * Trigger a manual fetch of both the environment features and users' traits for a given user id
     */
    export function getUserIdentity(userId: string): Promise<IUserIdentity>

    /**
     * Trigger a manual fetch of a specific trait for a given user id
     */
    export function getTrait(userId: string, key: string): Promise<ITraits>

    /**
     * Set a specific trait for a given user id
     */
    export function setTrait(
        userId: string,
        key: string,
        value: string
    ): IUserIdentity

    interface IBulletTrainFeature {
        enabled: boolean
        value?: string
    }

    interface IFlags {
        [key: string]: IBulletTrainFeature
    }

    interface ITraits {
        [key: string]: string
    }

    interface IUserIdentity {
        flags: IBulletTrainFeature
        traits: ITraits
    }
}
