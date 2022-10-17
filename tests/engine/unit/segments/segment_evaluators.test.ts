import {
    CONDITION_OPERATORS,
} from '../../../../flagsmith-engine/segments/constants';
import {
    SegmentConditionModel,
} from '../../../../flagsmith-engine/segments/models';
import {traitsMatchSegmentCondition} from "../../../../flagsmith-engine/segments/evaluators";
import {TraitModel} from "../../../../flagsmith-engine";

let traitExistenceTestCases: [string, string | null | undefined, string | null | undefined, TraitModel [],boolean][] = [
    [CONDITION_OPERATORS.IS_SET,'foo',null,[{traitKey: null, traitValue: undefined}] , false],
    [CONDITION_OPERATORS.IS_SET, 'foo',undefined , [{traitKey: 'foo', traitValue: 'bar'}], true],
    [CONDITION_OPERATORS.IS_SET, 'foo', null, [{traitKey: 'foo', traitValue: 'bar'},{traitKey: 'fooBaz', traitValue: 'baz'}], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null, [{traitKey: 'foo', traitValue: 'bar'}], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [{traitKey: null, traitValue: undefined}], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null, [{traitKey: 'foo', traitValue: 'bar'},{traitKey: 'fooBaz', traitValue: 'baz'}], false]
];

test('test_traits_match_segment_condition_for_trait_existence_operators', () => {
    for (const testCase of traitExistenceTestCases) {
        const [operator, conditionProperty, conditionValue, traits, expectedResult] = testCase
        let segmentModel = new SegmentConditionModel(operator, conditionValue, conditionProperty)
        expect(
           traitsMatchSegmentCondition (traits, segmentModel, 'any','any')
        ).toBe(expectedResult);
    }
});