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

const conditionMatchCases: [string, string | undefined, string | null | undefined, Array<any> ,boolean][] = [
    [CONDITION_OPERATORS.IS_SET, 'foo',null, [{}], false],
    //[CONDITION_OPERATORS.IS_SET, 'foo',undefined , [{'foo':'bar'}], true],
    //[CONDITION_OPERATORS.IS_NOT_SET, 'foo', null,[{'foo':'bar'}], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [{}], true]
];

test('test_segment_condition_matches_Trait', () => {
    for (const conditionModel of conditionMatchCases) {
        let traitsKey = Object.keys ((conditionModel[3])[0])
        let traitsValue = Object.values ((conditionModel[3])[0])
        const traitModel: TraitModel = new TraitModel (traitsKey[0], traitsValue[0]);
        expect(
            new SegmentConditionModel(conditionModel[0], conditionModel[2], (traitModel.traitKey)).matchesTraitValue(
                traitModel.traitValue
            )
        ).toBe(conditionModel[4]);
    }
});