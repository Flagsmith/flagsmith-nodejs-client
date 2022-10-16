import {
    CONDITION_OPERATORS,
} from '../../../../flagsmith-engine/segments/constants';
import {
    SegmentConditionModel,
} from '../../../../flagsmith-engine/segments/models';
import {traitsMatchSegmentCondition} from "../../../../flagsmith-engine/segments/evaluators";
import {TraitModel} from "../../../../build";

const conditionMatchesTraitkey: [string, string | null | undefined, string | null | undefined, Array<TraitModel > ,boolean][] = [
    [CONDITION_OPERATORS.IS_SET,'foo',null, [{traitKey:'',traitValue:''}], false],
    [CONDITION_OPERATORS.IS_SET, 'foo',undefined , [{traitKey:'foo',traitValue:'bar'}], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null,[{traitKey:'foo',traitValue:'bar'}], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [{traitKey:'',traitValue:''}], true],
    [CONDITION_OPERATORS.IS_SET, 'foo', null, [{traitKey:'foo',traitValue:'bar'}], true]
];

test('test_segment_condition_matches_Trait', () => {
    for (const conditionTraitProperty of conditionMatchesTraitkey) {
        let segmentModel = new SegmentConditionModel(conditionTraitProperty[0], conditionTraitProperty[2], conditionTraitProperty[1])
        expect(
           traitsMatchSegmentCondition (conditionTraitProperty[3], segmentModel, 'any','any')
        ).toBe(conditionTraitProperty[4]);
    }
});