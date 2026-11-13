/**
 * Steps for the Flagsmith SDK behavioural spec: https://github.com/Flagsmith/sdk-spec
 *
 * Each function implements the Gherkin step in the comment above it.
 */

import { Flag, Flagsmith, type Flags, type FlagsmithValue } from '@flagsmith/nodejs';

function asSpecFlags(flags: Flags) {
    return flags.allFlags().map(flag => ({
        feature: flag.featureName,
        enabled: flag.enabled,
        value: flag.value
    }));
}

// Create the SDK client
export function createClient(environmentKey: string, apiUrl: string) {
    return new Flagsmith({ environmentKey, apiUrl });
}

// Create the SDK client with local evaluation
export function createClientWithLocalEvaluation(environmentKey: string, apiUrl: string) {
    return new Flagsmith({ environmentKey, apiUrl, enableLocalEvaluation: true });
}

// Create the SDK client with events enabled
export function createClientWithEvents(
    environmentKey: string,
    apiUrl: string,
    eventsApiUrl: string
) {
    return new Flagsmith({
        environmentKey,
        apiUrl,
        enableEvents: true,
        eventProcessorConfig: { eventsApiUrl }
    });
}

// Create the SDK client with local evaluation and events enabled
export function createClientWithLocalEvaluationAndEvents(
    environmentKey: string,
    apiUrl: string,
    eventsApiUrl: string
) {
    return new Flagsmith({
        environmentKey,
        apiUrl,
        enableLocalEvaluation: true,
        enableEvents: true,
        eventProcessorConfig: { eventsApiUrl }
    });
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

// When the application gets the experiment flag "{feature}" for identity "{identifier}" with traits:
export async function getExperimentFlag(
    flagsmith: Flagsmith,
    feature: string,
    identifier: string,
    traits: Record<string, FlagsmithValue>
) {
    const flag = await flagsmith.getExperimentFlag(feature, identifier, traits);
    const featureName = flag instanceof Flag ? flag.featureName : feature; // A default flag has no name of its own
    return [{ feature: featureName, enabled: flag.enabled, value: flag.value }];
}

// When the application tracks event "{event}" for identity "{identifier}" with value {value} and metadata:
export function trackEvent(
    flagsmith: Flagsmith,
    event: string,
    identifier: string,
    value: FlagsmithValue,
    metadata: Record<string, unknown>
) {
    flagsmith.trackEvent(event, { identifier, value, metadata });
}

// When the application tracks an exposure of feature "{feature}" for identity "{identifier}" with value {value} and metadata:
export function trackExposureEvent(
    flagsmith: Flagsmith,
    feature: string,
    identifier: string,
    value: FlagsmithValue,
    metadata: Record<string, unknown>
) {
    flagsmith.trackExposureEvent(feature, { identifier, value, metadata });
}

// When the application tracks events "event_{first}" to "event_{last}" for identity "{identifier}"
export function trackNumberedEvents(
    flagsmith: Flagsmith,
    first: number,
    last: number,
    identifier: string
) {
    for (let number = Number(first); number <= Number(last); number++) {
        flagsmith.trackEvent(`event_${number}`, { identifier });
    }
}

// When the application flushes events
export async function flushEvents(flagsmith: Flagsmith) {
    await flagsmith.flushEvents();
}

// When the application closes the client with a timeout of {timeout} seconds
export async function close(flagsmith: Flagsmith, timeout: number) {
    await flagsmith.close(timeout * 1000);
}
