import {
    FeaturesWithMetadata,
    Traits,
    GenericEvaluationContext,
    EnvironmentContext,
    IdentityContext,
    SegmentSource,
    SDKFeatureMetadata,
    SegmentsWithMetadata,
    SDKSegmentMetadata
} from '../models.js';
import { EnvironmentModel } from '../../environments/models.js';
import { IdentityModel } from '../../identities/models.js';
import { TraitModel } from '../../identities/traits/models.js';
import { FeatureStateModel } from '../../features/models.js';
import { SegmentRuleModel } from '../../segments/models.js';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from '../../segments/constants.js';
import { createHash } from 'node:crypto';
import { uuidToBigInt } from '../../features/util.js';

export function getEvaluationContext(
    environment: EnvironmentModel,
    identity?: IdentityModel,
    overrideTraits?: TraitModel[],
    isEnvironmentEvaluation: boolean = false
): GenericEvaluationContext {
    const environmentContext = mapEnvironmentModelToEvaluationContext(
        environment,
        isEnvironmentEvaluation
    );
    if (isEnvironmentEvaluation) {
        return environmentContext;
    }
    const identityContext = identity
        ? mapIdentityModelToIdentityContext(identity, overrideTraits)
        : undefined;

    const context = {
        ...environmentContext,
        ...(identityContext && { identity: identityContext })
    };

    return context;
}

const IDENTITY_FREE_PROPERTY_PREFIXES = [
    '$.environment.',
    '$.environment[',
    '$.flags.',
    '$.flags['
];

/**
 * Whether segment rules can be evaluated without an identity, i.e. they read no traits nor identity.
 */
function isIdentityFree(rules: SegmentRuleModel[]): boolean {
    return rules.every(
        rule =>
            rule.conditions.every(condition =>
                IDENTITY_FREE_PROPERTY_PREFIXES.some(prefix =>
                    condition.property?.startsWith(prefix)
                )
            ) && isIdentityFree(rule.rules)
    );
}

function mapEnvironmentModelToEvaluationContext(
    environment: EnvironmentModel,
    isEnvironmentEvaluation: boolean
): GenericEvaluationContext {
    const environmentContext: EnvironmentContext = {
        key: environment.apiKey,
        name: environment.name
    };

    const features: FeaturesWithMetadata<SDKFeatureMetadata> = {};
    for (const fs of environment.featureStates) {
        features[fs.feature.name] = {
            key: fs.djangoID?.toString() || fs.featurestateUUID,
            name: fs.feature.name,
            enabled: fs.enabled,
            value: fs.getValue(),
            variants: mapFeatureStateVariants(fs),
            priority: fs.featureSegment?.priority,
            metadata: {
                id: fs.feature.id
            }
        };
    }

    const segmentOverrides: SegmentsWithMetadata<SDKSegmentMetadata> = {};
    for (const segment of environment.project.segments) {
        if (isEnvironmentEvaluation && !isIdentityFree(segment.rules)) continue;
        segmentOverrides[segment.id.toString()] = {
            key: segment.id.toString(),
            name: segment.name,
            rules: segment.rules.map(rule => mapSegmentRuleModelToRule(rule)),
            overrides:
                segment.featureStates.length > 0
                    ? segment.featureStates.map(fs => ({
                          key: fs.djangoID?.toString() || fs.featurestateUUID,
                          name: fs.feature.name,
                          enabled: fs.enabled,
                          value: fs.getValue(),
                          variants: mapFeatureStateVariants(fs),
                          priority: fs.featureSegment?.priority,
                          metadata: {
                              id: fs.feature.id
                          }
                      }))
                    : [],
            metadata: {
                source: SegmentSource.API,
                id: segment.id
            }
        };
    }

    let identityOverrideSegments: SegmentsWithMetadata<SDKSegmentMetadata> = {};
    if (
        !isEnvironmentEvaluation &&
        environment.identityOverrides &&
        environment.identityOverrides.length > 0
    ) {
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

    const identityContext: IdentityContext = {
        identifier: identity.identifier,
        traits: traitsContext
    };

    return identityContext;
}

function mapFeatureStateVariants(fs: FeatureStateModel) {
    return fs.multivariateFeatureStateValues?.length > 0
        ? fs.multivariateFeatureStateValues.map(mv => ({
              value: mv.multivariateFeatureOption.value,
              weight: mv.percentageAllocation,
              priority: mv.id ?? uuidToBigInt(mv.mvFsValueUuid),
              ...(mv.multivariateFeatureOption.key && { key: mv.multivariateFeatureOption.key })
          }))
        : undefined;
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

function mapIdentityOverridesToSegments(
    identityOverrides: IdentityModel[]
): SegmentsWithMetadata<SDKSegmentMetadata> {
    const segments: SegmentsWithMetadata<SDKSegmentMetadata> = {};
    const featuresToIdentifiers = new Map<string, { identifiers: string[]; overrides: any[] }>();

    for (const identity of identityOverrides) {
        if (!identity.identityFeatures || identity.identityFeatures.length === 0) {
            continue;
        }

        const sortedFeatures = [...identity.identityFeatures].sort((a, b) =>
            a.feature.name.localeCompare(b.feature.name)
        );
        const overridesKey = sortedFeatures.map(fs => ({
            key: fs.djangoID?.toString() || fs.featurestateUUID,
            name: fs.feature.name,
            enabled: fs.enabled,
            value: fs.getValue(),
            variants: mapFeatureStateVariants(fs),
            priority: -Infinity,
            metadata: {
                id: fs.feature.id
            }
        }));

        const overridesHash = createHash('sha1')
            .update(
                JSON.stringify(
                    overridesKey.map(({ key, ...rest }) => rest),
                    (_, value) => (typeof value === 'bigint' ? value.toString() : value)
                )
            )
            .digest('hex');

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
