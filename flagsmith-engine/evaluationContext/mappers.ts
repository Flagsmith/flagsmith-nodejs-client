import {
    Features,
    Segments,
    Traits,
    EvaluationContext,
    EnvironmentContext,
    IdentityContext
} from './models.js';
import { EnvironmentModel } from '../environments/models.js';
import { IdentityModel } from '../identities/models.js';
import { TraitModel } from '../identities/traits/models.js';
import { IDENTITY_OVERRIDE_SEGMENT_NAME } from '../segments/constants.js';

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
        ...(identityContext && { identity: identityContext }),
        segments: {
            ...environmentContext.segments,
            ...(identity && mapIdentityOverridesToSegments(identity))
        }
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
                      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
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

    const segments: Segments = {};
    for (const segment of environment.project.segments) {
        segments[segment.id.toString()] = {
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
                    : []
        };
    }

    return {
        environment: environmentContext,
        features,
        segments
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

function mapIdentityOverridesToSegments(identity: IdentityModel): Segments {
    const segments: Segments = {};

    if (!identity.identityFeatures || identity.identityFeatures.length === 0) {
        return segments;
    }

    const overrides = identity.identityFeatures.map(fs => ({
        key: fs.djangoID?.toString() || fs.featurestateUUID,
        feature_key: fs.feature.id.toString(),
        name: fs.feature.name,
        enabled: fs.enabled,
        value: fs.getValue(),
        priority: -Infinity
    }));

    // Can be grouped in a massive IN segment with all the overrides
    const segmentKey = `identity_override_${identity.identifier}`;

    segments[segmentKey] = {
        key: segmentKey,
        name: IDENTITY_OVERRIDE_SEGMENT_NAME,
        rules: [
            {
                type: 'ALL',
                conditions: [
                    {
                        property: '$.identity.identifier',
                        operator: 'EQUAL',
                        value: identity.identifier
                    }
                ]
            }
        ],
        overrides
    };

    return segments;
}
