import {
    ALL_RULE,
    CONDITION_OPERATORS,
    PERCENTAGE_SPLIT,
} from '../../../../flagsmith-engine/segments/constants';
import {SegmentConditionModel} from '../../../../flagsmith-engine/segments/models';
import {traitsMatchSegmentCondition, evaluateIdentityInSegment} from "../../../../flagsmith-engine/segments/evaluators";
import {TraitModel, IdentityModel} from "../../../../flagsmith-engine";
import {environment} from "../utils";
import { buildSegmentModel } from '../../../../flagsmith-engine/segments/util';
import { getHashedPercentateForObjIds } from '../../../../flagsmith-engine/utils/hashing';


// todo: work out how to implement this in a test function or before hook
jest.mock('../../../../flagsmith-engine/utils/hashing', () => ({
    getHashedPercentateForObjIds: jest.fn(() => 1)
}));


let traitExistenceTestCases: [string, string | null | undefined, string | null | undefined, TraitModel [],boolean][] = [
    [CONDITION_OPERATORS.IS_SET,'foo', null,[] , false],
    [CONDITION_OPERATORS.IS_SET, 'foo',undefined , [new TraitModel('foo','bar')], true],
    [CONDITION_OPERATORS.IS_SET, 'foo',undefined , [new TraitModel('foo','bar'), new TraitModel('fooBaz','baz')], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null, [new TraitModel('foo','bar')], false],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null, [new TraitModel('foo','bar'), new TraitModel('fooBaz','baz')], false]
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


test('evaluateIdentityInSegment uses django ID for hashed percentage when present', () => {
    var identityModel = new IdentityModel(Date.now().toString(), [], [], environment().apiKey, 'identity_1', undefined, 1);
    const segmentDefinition = {
        id: 1,
        name: 'percentage_split_segment',
        rules: [
            {
                type: ALL_RULE,
                conditions: [
                    {
                        operator: PERCENTAGE_SPLIT,
                        property_: null,
                        value: "10"
                    }
                ],
                rules: []
            }
        ],
        feature_states: []
    };
    const segmentModel = buildSegmentModel(segmentDefinition);

    var result = evaluateIdentityInSegment(identityModel, segmentModel);

    expect(result).toBe(true);
    expect(getHashedPercentateForObjIds).toHaveBeenCalledTimes(1)
    expect(getHashedPercentateForObjIds).toHaveBeenCalledWith([segmentModel.id, identityModel.djangoID])
});
