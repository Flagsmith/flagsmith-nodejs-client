import {
    ALL_RULE,
    CONDITION_OPERATORS,
    PERCENTAGE_SPLIT
} from '../../../../flagsmith-engine/segments/constants.js';
import { SegmentConditionModel } from '../../../../flagsmith-engine/segments/models.js';
import {
    traitsMatchSegmentCondition,
    evaluateIdentityInSegment
} from '../../../../flagsmith-engine/segments/evaluators.js';
import { TraitModel, IdentityModel } from '../../../../flagsmith-engine/index.js';
import { environment } from '../utils.js';
import { buildSegmentModel } from '../../../../flagsmith-engine/segments/util.js';
import { getHashedPercentageForObjIds } from '../../../../flagsmith-engine/utils/hashing/index.js';
import { getEvaluationContext } from '../../../../flagsmith-engine/evaluationContext/mappers.js';
import { EvaluationContext } from '../../../../flagsmith-engine/evaluationContext/evaluationContext.types.js';

// todo: work out how to implement this in a test function or before hook
vi.mock('../../../../flagsmith-engine/utils/hashing', () => ({
    getHashedPercentageForObjIds: vi.fn(() => 1)
}));

let traitExistenceTestCases: [
    string,
    string | null | undefined,
    string | null | undefined,
    TraitModel[],
    boolean
][] = [
    [CONDITION_OPERATORS.IS_SET, 'foo', null, [], false],
    [CONDITION_OPERATORS.IS_SET, 'foo', undefined, [new TraitModel('foo', 'bar')], true],
    [
        CONDITION_OPERATORS.IS_SET,
        'foo',
        undefined,
        [new TraitModel('foo', 'bar'), new TraitModel('fooBaz', 'baz')],
        true
    ],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', undefined, [], true],
    [CONDITION_OPERATORS.IS_NOT_SET, 'foo', null, [new TraitModel('foo', 'bar')], false],
    [
        CONDITION_OPERATORS.IS_NOT_SET,
        'foo',
        null,
        [new TraitModel('foo', 'bar'), new TraitModel('fooBaz', 'baz')],
        false
    ]
];

test('test_traits_match_segment_condition_for_trait_existence_operators', () => {
    for (const testCase of traitExistenceTestCases) {
        const [operator, conditionProperty, conditionValue, traits, expectedResult] = testCase;
        let segmentConditionModel = new SegmentConditionModel(
            operator,
            conditionValue,
            conditionProperty
        );
        const traitsMap = traits.reduce((acc, trait) => {
            acc[trait.traitKey] = trait.traitValue;
            return acc;
        }, {});
        const context: EvaluationContext = {
            environment: {
                key: 'any',
                name: 'any'
            },
            identity: {
                traits: traitsMap,
                key: 'any',
                identifier: 'any'
            }
        };
        expect(traitsMatchSegmentCondition(segmentConditionModel, 'any', context)).toBe(
            expectedResult
        );
    }
});

test('evaluateIdentityInSegment uses django ID for hashed percentage when present', () => {
    var identityModel = new IdentityModel(
        Date.now().toString(),
        [],
        [],
        environment().apiKey,
        'identity_1',
        undefined,
        1
    );
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
                        value: '10'
                    }
                ],
                rules: []
            }
        ],
        feature_states: []
    };
    const segmentModel = buildSegmentModel(segmentDefinition);
    const environmentModel = environment();
    environmentModel.project.segments = [segmentModel];
    const context = getEvaluationContext(environmentModel, identityModel);

    const segmentContext = context.segments![1];
    var result = evaluateIdentityInSegment(segmentContext, context);

    expect(result).toBe(true);
    expect(getHashedPercentageForObjIds).toHaveBeenCalledTimes(1);
    expect(getHashedPercentageForObjIds).toHaveBeenCalledWith([
        segmentContext.key,
        context.identity!.key
    ]);
});
