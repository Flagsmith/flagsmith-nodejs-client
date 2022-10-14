import {
    CONDITION_OPERATORS,
} from '../../../../flagsmith-engine/segments/constants';
import {
    SegmentConditionModel,
} from '../../../../flagsmith-engine/segments/models';
import {traitsMatchSegmentCondition} from "../../../../flagsmith-engine/segments/evaluators";

const conditionMatchCases: [string, string | null | undefined, string | null | undefined, Array<any> ,boolean][] = [
    [CONDITION_OPERATORS.IS_SET,'foo',null, [{}], false],
    [CONDITION_OPERATORS.IS_SET, 'foo',undefined , [{foo:'bar'}], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null,[{johnny: 'bravo'}, {'foo':'bar'}], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [{}], true],
    [CONDITION_OPERATORS.IS_SET, 'foo', null, [{johnny: 'bravo'}, {foo: 'bar'}], true]
];

test('test_segment_condition_matches_Trait', () => {
    for (const conditionTraits of conditionMatchCases) {
        let segmentModel = new SegmentConditionModel(conditionTraits[0], conditionTraits[2], conditionTraits[1])
        expect(
           traitsMatchSegmentCondition (conditionTraits[3], segmentModel, 'any','any')
        ).toBe(conditionTraits[4]);
    }
});