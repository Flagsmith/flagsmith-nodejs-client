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

const conditionMatchCases: [string, string | number | boolean, string, object ,boolean][] = [
    [CONDITION_OPERATORS.IS_SET, 'foo','', {}, false],
    [CONDITION_OPERATORS.IS_SET, 'foo', '', {'foo':'bar'}, true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', '',{'foo':'bar'}, false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', '', {}, true]
];

test('test_segment_condition_matches_Trait', () => {
    const trait_key = new TraitModel (segmentConditionProperty, segmentConditionStringValue);
    const trait_models = Object.values(trait_key)
    for (const testCase of conditionMatchCases) {
        expect(
            trait_models[0]==testCase[1]
        ).toBe(testCase[4]);
    }
});