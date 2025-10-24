import { SegmentSource } from '../../../../flagsmith-engine/evaluation/models';
import { EvaluationContext } from '../../../../flagsmith-engine/evaluationContext/evaluationContext.types';
import { CONSTANTS } from '../../../../flagsmith-engine/features/constants';
import {
    ALL_RULE,
    ANY_RULE,
    CONDITION_OPERATORS,
    NONE_RULE
} from '../../../../flagsmith-engine/segments/constants';
import {
    all,
    any,
    SegmentConditionModel,
    SegmentModel,
    SegmentRuleModel
} from '../../../../flagsmith-engine/segments/models';

const conditionMatchCases: [string, string | number | boolean | null, string, boolean][] = [
    [CONDITION_OPERATORS.EQUAL, 'bar', 'bar', true],
    [CONDITION_OPERATORS.EQUAL, 'bar', 'baz', false],
    [CONDITION_OPERATORS.EQUAL, 1, '1', true],
    [CONDITION_OPERATORS.EQUAL, 1, '2', false],
    [CONDITION_OPERATORS.EQUAL, true, 'true', true],
    [CONDITION_OPERATORS.EQUAL, false, 'false', true],
    [CONDITION_OPERATORS.EQUAL, false, 'true', false],
    [CONDITION_OPERATORS.EQUAL, true, 'false', false],
    [CONDITION_OPERATORS.EQUAL, 1.23, '1.23', true],
    [CONDITION_OPERATORS.EQUAL, 1.23, '4.56', false],
    [CONDITION_OPERATORS.GREATER_THAN, 2, '1', true],
    [CONDITION_OPERATORS.GREATER_THAN, 1, '1', false],
    [CONDITION_OPERATORS.GREATER_THAN, 0, '1', false],
    [CONDITION_OPERATORS.GREATER_THAN, 2.1, '2.0', true],
    [CONDITION_OPERATORS.GREATER_THAN, 2.1, '2.1', false],
    [CONDITION_OPERATORS.GREATER_THAN, 2.0, '2.1', false],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 2, '1', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 1, '1', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 0, '1', false],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 2.1, '2.0', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 2.1, '2.1', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, 2.0, '2.1', false],
    [CONDITION_OPERATORS.LESS_THAN, 1, '2', true],
    [CONDITION_OPERATORS.LESS_THAN, 1, '1', false],
    [CONDITION_OPERATORS.LESS_THAN, 1, '0', false],
    [CONDITION_OPERATORS.LESS_THAN, 2.0, '2.1', true],
    [CONDITION_OPERATORS.LESS_THAN, 2.1, '2.1', false],
    [CONDITION_OPERATORS.LESS_THAN, 2.1, '2.0', false],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 1, '2', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 1, '1', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 1, '0', false],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 2.0, '2.1', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 2.1, '2.1', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, 2.1, '2.0', false],
    [CONDITION_OPERATORS.NOT_EQUAL, 'bar', 'baz', true],
    [CONDITION_OPERATORS.NOT_EQUAL, 'bar', 'bar', false],
    [CONDITION_OPERATORS.NOT_EQUAL, 1, '2', true],
    [CONDITION_OPERATORS.NOT_EQUAL, 1, '1', false],
    [CONDITION_OPERATORS.NOT_EQUAL, true, 'false', true],
    [CONDITION_OPERATORS.NOT_EQUAL, false, 'true', true],
    [CONDITION_OPERATORS.NOT_EQUAL, false, 'false', false],
    [CONDITION_OPERATORS.NOT_EQUAL, true, 'true', false],
    [CONDITION_OPERATORS.CONTAINS, 'bar', 'b', true],
    [CONDITION_OPERATORS.CONTAINS, 'bar', 'bar', true],
    [CONDITION_OPERATORS.CONTAINS, 'bar', 'baz', false],
    [CONDITION_OPERATORS.CONTAINS, null, 'foo', false],
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'b', false],
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'bar', false],
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'baz', true],
    [CONDITION_OPERATORS.NOT_CONTAINS, null, 'foo', false],
    [CONDITION_OPERATORS.REGEX, 'foo', '[a-z]+', true],
    [CONDITION_OPERATORS.REGEX, 'FOO', '[a-z]+', false],
    [CONDITION_OPERATORS.REGEX, null, '[a-z]+', false],
    [CONDITION_OPERATORS.EQUAL, '1.0.0', '1.0.0:semver', true],
    [CONDITION_OPERATORS.EQUAL, '1.0.0', '1.0.0:semver', true],
    [CONDITION_OPERATORS.EQUAL, '1.0.0', '1.0.1:semver', false],
    [CONDITION_OPERATORS.NOT_EQUAL, '1.0.0', '1.0.0:semver', false],
    [CONDITION_OPERATORS.NOT_EQUAL, '1.0.0', '1.0.1:semver', true],
    [CONDITION_OPERATORS.GREATER_THAN, '1.0.1', '1.0.0:semver', true],
    [CONDITION_OPERATORS.GREATER_THAN, '1.0.0', '1.0.0-beta:semver', true],
    [CONDITION_OPERATORS.GREATER_THAN, '1.0.1', '1.2.0:semver', false],
    [CONDITION_OPERATORS.GREATER_THAN, '1.0.1', '1.0.1:semver', false],
    [CONDITION_OPERATORS.GREATER_THAN, '1.2.4', '1.2.3-pre.2+build.4:semver', true],
    [CONDITION_OPERATORS.LESS_THAN, '1.0.0', '1.0.1:semver', true],
    [CONDITION_OPERATORS.LESS_THAN, '1.0.0', '1.0.0:semver', false],
    [CONDITION_OPERATORS.LESS_THAN, '1.0.1', '1.0.0:semver', false],
    [CONDITION_OPERATORS.LESS_THAN, '1.0.0-rc.2', '1.0.0-rc.3:semver', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, '1.0.1', '1.0.0:semver', true],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, '1.0.1', '1.2.0:semver', false],
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE, '1.0.1', '1.0.1:semver', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, '1.0.0', '1.0.1:semver', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, '1.0.0', '1.0.0:semver', true],
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE, '1.0.1', '1.0.0:semver', false],
    [CONDITION_OPERATORS.MODULO, 1, '2|0', false],
    [CONDITION_OPERATORS.MODULO, 2, '2|0', true],
    [CONDITION_OPERATORS.MODULO, 3, '2|0', false],
    [CONDITION_OPERATORS.MODULO, 34.2, '4|3', false],
    [CONDITION_OPERATORS.MODULO, 35.0, '4|3', true],
    [CONDITION_OPERATORS.MODULO, 'foo', '4|3', false],
    [CONDITION_OPERATORS.MODULO, 35.0, 'foo|bar', false],
    [CONDITION_OPERATORS.IN, 'foo', '', false],
    [CONDITION_OPERATORS.IN, 'foo', 'foo, bar', true],
    [CONDITION_OPERATORS.IN, 'foo', 'foo', true],
    [CONDITION_OPERATORS.IN, 1, '1,2,3,4', true],
    [CONDITION_OPERATORS.IN, 1, '', false],
    [CONDITION_OPERATORS.IN, 1, '1', true],
    ['BAD_OP', 'a', 'a', false]
];

test('test_segment_condition_matches_trait_value', () => {
    for (const testCase of conditionMatchCases) {
        const [operator, traitValue, conditionValue, expectedResult] = testCase;
        expect(
            new SegmentConditionModel(operator, conditionValue, 'foo').matchesTraitValue(traitValue)
        ).toBe(expectedResult);
    }
});

test('test_segment_rule_none', () => {
    const testCases: [boolean[], boolean][] = [
        [[], true],
        [[false], true],
        [[false, false], true],
        [[false, true], false],
        [[true, true], false]
    ];

    for (const testCase of testCases) {
        expect(SegmentRuleModel.none(testCase[0])).toBe(testCase[1]);
    }
});

test('test_segment_rule_matching_function', () => {
    const testCases: [string, CallableFunction][] = [
        [ALL_RULE, all],
        [ANY_RULE, any],
        [NONE_RULE, SegmentRuleModel.none]
    ];

    for (const testCase of testCases) {
        expect(new SegmentRuleModel(testCase[0]).matchingFunction()).toBe(testCase[1]);
    }
});

test('test_fromSegmentResult_with_multiple_variants', () => {
    const segmentResults = [{ name: 'test_segment', metadata: { flagsmithId: '1' } }];

    const evaluationContext: EvaluationContext = {
        identity: {
            key: 'not_exist',
            identifier: 'not_exist'
        },
        environment: {
            key: 'test',
            name: 'test'
        },
        features: {},
        segments: {
            '1': {
                key: '1',
                name: 'test_segment',
                metadata: {
                    source: SegmentSource.API,
                    flagsmithId: '1'
                },
                rules: [
                    {
                        type: 'ALL',
                        conditions: [
                            {
                                property: '$.identity.identifier',
                                operator: 'EQUAL',
                                value: 'test-user'
                            }
                        ]
                    }
                ],
                overrides: [
                    {
                        key: 'override',
                        name: 'multivariate_feature',
                        enabled: true,
                        value: 'default_value',
                        priority: 1,
                        metadata: {
                            flagsmithId: 1
                        },
                        variants: [
                            { id: 1, value: 'variant_a', weight: 30 },
                            { id: 2, value: 'variant_b', weight: 70 }
                        ]
                    }
                ]
            }
        }
    };

    const result = SegmentModel.fromSegmentResult(segmentResults, evaluationContext);

    expect(result).toHaveLength(1);

    const segment = result[0];
    expect(segment.name).toBe('test_segment');
    expect(segment.featureStates).toHaveLength(1);

    const featureState = segment.featureStates[0];
    expect(featureState.feature.name).toBe('multivariate_feature');
    expect(featureState.feature.type).toBe(CONSTANTS.MULTIVARIATE);
    expect(featureState.enabled).toBe(true);
    expect(featureState.getValue()).toBe('default_value');

    // Test multivariate variants
    expect(featureState.multivariateFeatureStateValues).toHaveLength(2);

    const variant1 = featureState.multivariateFeatureStateValues[0];
    expect(variant1.multivariateFeatureOption.value).toBe('variant_a');
    expect(variant1.percentageAllocation).toBe(30);
    expect(variant1.id).toBe(1);

    const variant2 = featureState.multivariateFeatureStateValues[1];
    expect(variant2.multivariateFeatureOption.value).toBe('variant_b');
    expect(variant2.percentageAllocation).toBe(70);
    expect(variant2.id).toBe(2);
});
