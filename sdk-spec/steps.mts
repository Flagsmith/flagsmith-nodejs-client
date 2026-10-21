/**
 * Steps for the Flagsmith SDK behavioural spec: https://github.com/Flagsmith/sdk-spec
 *
 * Each function implements the Gherkin step in the comment above it.
 */

import { Flagsmith, type Flags, type FlagsmithValue } from '@flagsmith/nodejs';

function asSpecFlags(flags: Flags) {
    return flags.allFlags().map(flag => ({
        feature: flag.featureName,
        enabled: flag.enabled,
        value: flag.value
    }));
}

// Given an SDK client for the environment
export function createClient(environmentKey: string, apiUrl: string) {
    return new Flagsmith({ environmentKey, apiUrl });
}

// When the application gets the environment flags
export async function getEnvironmentFlags(flagsmith: Flagsmith) {
    return asSpecFlags(await flagsmith.getEnvironmentFlags());
}

// When the application gets the flags for identity "{identifier}" with traits:
export async function getIdentityFlags(
    flagsmith: Flagsmith,
    identifier: string,
    traits: Record<string, FlagsmithValue>
) {
    return asSpecFlags(await flagsmith.getIdentityFlags(identifier, traits));
}
