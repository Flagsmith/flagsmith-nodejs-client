import {
    ALL_RULE,
    ANY_RULE,
    CONDITION_OPERATORS,
    NONE_RULE
} from '../../../flagsmith-engine/segments/constants';
import {
    all,
    any,
    SegmentConditionModel,
    SegmentRuleModel
} from '../../../flagsmith-engine/segments/models';

const conditionMatchCases: [string, string | number | boolean, string, boolean][] = [
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
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'b', false],
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'bar', false],
    [CONDITION_OPERATORS.NOT_CONTAINS, 'bar', 'baz', true],
    [CONDITION_OPERATORS.REGEX, 'foo', '[a-z]+', true],
    [CONDITION_OPERATORS.REGEX, 'FOO', '[a-z]+', false]
];

test('test_segment_condition_matches_trait_value', () => {
    for (const testCase of conditionMatchCases) {
        expect(
            new SegmentConditionModel(testCase[0], testCase[2], 'foo').matchesTraitValue(
                testCase[1]
            )
        ).toBe(testCase[3]);
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
