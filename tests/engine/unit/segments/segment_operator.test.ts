import {
    CONDITION_OPERATORS,
} from '../../../../flagsmith-engine/segments/constants';
import {
    segmentConditionProperty,
    segmentConditionStringValue
} from "../utils";
import {
    SegmentConditionModel,
} from '../../../../flagsmith-engine/segments/models';
import {TraitModel} from "../../../../flagsmith-engine";

const conditionMatchCases: [string, string | undefined, string | null, Array<any> ,boolean][] = [
    [CONDITION_OPERATORS.IS_SET, 'foo',null, [{null:null}], false],
    [CONDITION_OPERATORS.IS_SET, 'foo', '', [{'foo':'bar'}], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null,[{'foo':'bar'}], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', '', [{null:null}], true]
];

test('test_segment_condition_matches_Trait', () => {
    for (const conditionModel of conditionMatchCases) {
        const traitModel: TraitModel = new TraitModel (segmentConditionProperty, segmentConditionStringValue);
        expect(
            new SegmentConditionModel(conditionModel[0], conditionModel[2], traitModel.traitKey).matchesTraitValue(
                Object.keys(conditionModel[3])
            )
        ).toBe(conditionModel[4]);
    }
});