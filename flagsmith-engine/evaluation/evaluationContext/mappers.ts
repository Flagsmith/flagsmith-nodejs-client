import {
    Features,
    Segments,
    Traits,
    EvaluationContext,
    EnvironmentContext,
    IdentityContext,
    SegmentSource
} from '../models.js';
import { EnvironmentModel } from '../../environments/models.js';
import { IdentityModel } from '../../identities/models.js';
import { TraitModel } from '../../identities/traits/models.js';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from '../../segments/constants.js';
import { createHash } from 'node:crypto';

export function getEvaluationContext(
    environment: EnvironmentModel,
    identity?: IdentityModel,
    overrideTraits?: TraitModel[]
): EvaluationContext {
    const environmentContext = mapEnvironmentModelToEvaluationContext(environment);
    const identityContext = identity
        ? mapIdentityModelToIdentityContext(identity, overrideTraits)
        : undefined;

    const context = {
        ...environmentContext,
        ...(identityContext && { identity: identityContext })
    };

    return context;
}

function mapEnvironmentModelToEvaluationContext(environment: EnvironmentModel): EvaluationContext {
    const environmentContext: EnvironmentContext = {
        key: environment.apiKey,
        name: environment.project.name
    };

    const features: Features = {};
    for (const fs of environment.featureStates) {
        const variants =
            fs.multivariateFeatureStateValues.length > 0
                ? [...fs.multivariateFeatureStateValues]
                      .sort((a, b) => (a.id ?? a.mvFsValueUuid) - (b.id ?? b.mvFsValueUuid))
                      .map(mv => ({
                          value: mv.multivariateFeatureOption.value,
                          weight: mv.percentageAllocation
                      }))
                : undefined;
        features[fs.feature.name] = {
            key: fs.djangoID?.toString() || fs.featurestateUUID,
            feature_key: fs.feature.id.toString(),
            name: fs.feature.name,
            enabled: fs.enabled,
            value: fs.getValue(),
            variants,
            priority: fs.featureSegment?.priority
        };
    }

    const segmentOverrides: Segments = {};
    for (const segment of environment.project.segments) {
        segmentOverrides[segment.id.toString()] = {
            key: segment.id.toString(),
            name: segment.name,
            rules: segment.rules.map(rule => mapSegmentRuleModelToRule(rule)),
            overrides:
                segment.featureStates.length > 0
                    ? segment.featureStates.map(fs => ({
                          key: fs.djangoID?.toString() || fs.featurestateUUID,
                          feature_key: fs.feature.id.toString(),
                          name: fs.feature.name,
                          enabled: fs.enabled,
                          value: fs.getValue(),
                          priority: fs.featureSegment?.priority
                      }))
                    : [],
            metadata: {
                source: SegmentSource.API,
                flagsmith_id: segment.id
            }
        };
    }

    let identityOverrideSegments: Segments = {};
    if (environment.identityOverrides && environment.identityOverrides.length > 0) {
        identityOverrideSegments = mapIdentityOverridesToSegments(environment.identityOverrides);
    }

    return {
        environment: environmentContext,
        features,
        segments: {
            ...segmentOverrides,
            ...identityOverrideSegments
        }
    };
}

function mapIdentityModelToIdentityContext(
    identity: IdentityModel,
    overrideTraits?: TraitModel[]
): IdentityContext {
    const traits = overrideTraits || identity.identityTraits;
    const traitsContext: Traits = {};

    for (const trait of traits) {
        traitsContext[trait.traitKey] = trait.traitValue;
    }

    return {
        identifier: identity.identifier,
        key: identity.djangoID?.toString() || identity.compositeKey,
        traits: traitsContext
    };
}

function mapSegmentRuleModelToRule(rule: any): any {
    return {
        type: rule.type,
        conditions: rule.conditions.map((condition: any) => ({
            property: condition.property,
            operator: condition.operator,
            value: condition.value
        })),
        rules: rule.rules.map((subRule: any) => mapSegmentRuleModelToRule(subRule))
    };
}

function mapIdentityOverridesToSegments(identityOverrides: IdentityModel[]): Segments {
    const segments: Segments = {};
    const featuresToIdentifiers = new Map<string, { identifiers: string[]; overrides: any[] }>();

    for (const identity of identityOverrides) {
        if (!identity.identityFeatures || identity.identityFeatures.length === 0) {
            continue;
        }

        const sortedFeatures = [...identity.identityFeatures].sort((a, b) =>
            a.feature.name.localeCompare(b.feature.name)
        );
        const overridesKey = sortedFeatures.map(fs => ({
            feature_key: fs.feature.id.toString(),
            name: fs.feature.name,
            enabled: fs.enabled,
            value: fs.getValue(),
            priority: -Infinity
        }));

        const overridesHash = createHash('sha1').update(JSON.stringify(overridesKey)).digest('hex');

        if (!featuresToIdentifiers.has(overridesHash)) {
            featuresToIdentifiers.set(overridesHash, { identifiers: [], overrides: overridesKey });
        }

        featuresToIdentifiers.get(overridesHash)!.identifiers.push(identity.identifier);
    }

    for (const [overrideHash, { identifiers, overrides }] of featuresToIdentifiers.entries()) {
        const segmentKey = `identity_override_${overrideHash}`;

        segments[segmentKey] = {
            key: segmentKey,
            name: IDENTITY_OVERRIDE_SEGMENT_NAME,
            rules: [
                {
                    type: 'ALL',
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'IN',
                            value: identifiers.join(',')
                        }
                    ]
                }
            ],
            metadata: {
                source: SegmentSource.IDENTITY_OVERRIDE
            },
            overrides: overrides
        };
    }

    return segments;
}
