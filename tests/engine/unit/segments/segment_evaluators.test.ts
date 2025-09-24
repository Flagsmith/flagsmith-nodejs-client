import {
    ALL_RULE,
    CONDITION_OPERATORS,
    PERCENTAGE_SPLIT
} from '../../../../flagsmith-engine/segments/constants.js';

import {
    traitsMatchSegmentCondition,
    evaluateIdentityInSegment,
    getContextValue,
    getIdentitySegments
} from '../../../../flagsmith-engine/segments/evaluators.js';
import { TraitModel, IdentityModel } from '../../../../flagsmith-engine/index.js';
import { environment } from '../utils.js';
import { buildSegmentModel } from '../../../../flagsmith-engine/segments/util.js';
import { getHashedPercentageForObjIds } from '../../../../flagsmith-engine/utils/hashing/index.js';
import { getEvaluationContext } from '../../../../flagsmith-engine/evaluation/evaluationContext/mappers.js';
import {
    EvaluationContext,
    InSegmentCondition,
    SegmentCondition,
    SegmentCondition1,
    SegmentContext
} from '../../../../flagsmith-engine/evaluation/models.js';

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
        let segmentConditionModel = {
            operator,
            value: conditionValue,
            property: conditionProperty
        };
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
        expect(
            traitsMatchSegmentCondition(segmentConditionModel as SegmentCondition, 'any', context)
        ).toBe(expectedResult);
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

describe('getIdentitySegments integration', () => {
    test('returns only matching segments', () => {
        const context: EvaluationContext = {
            environment: { key: 'env', name: 'test' },
            identity: {
                key: 'user',
                identifier: 'premium@example.com',
                traits: { subscription: 'premium' }
            },
            segments: {
                '1': {
                    key: '1',
                    name: 'premium_users',
                    rules: [
                        {
                            type: 'ALL',
                            conditions: [
                                { property: 'subscription', operator: 'EQUAL', value: 'premium' }
                            ]
                        }
                    ],
                    overrides: []
                },
                '2': {
                    key: '2',
                    name: 'basic_users',
                    rules: [
                        {
                            type: 'ALL',
                            conditions: [
                                { property: 'subscription', operator: 'EQUAL', value: 'basic' }
                            ]
                        }
                    ],
                    overrides: []
                }
            },
            features: {}
        };

        const result = getIdentitySegments(context);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('premium_users');
    });

    test('returns empty array when no segments match', () => {
        const context: EvaluationContext = {
            environment: { key: 'env', name: 'test' },
            identity: {
                key: 'user',
                identifier: 'test@example.com',
                traits: { subscription: 'free' }
            },
            segments: {
                '1': {
                    key: '1',
                    name: 'premium_users',
                    rules: [
                        {
                            type: 'ALL',
                            conditions: [
                                { property: 'subscription', operator: 'EQUAL', value: 'premium' }
                            ]
                        }
                    ],
                    overrides: []
                }
            },
            features: {}
        };

        const result = getIdentitySegments(context);
        expect(result).toEqual([]);
    });
});

describe('IN operator', () => {
    const mockContext: EvaluationContext = {
        environment: { key: 'env', name: 'test' },
        identity: {
            key: 'test-user',
            identifier: 'test',
            traits: { name: 'test' }
        },
        segments: {},
        features: {}
    };

    test.each([
        // Array of strings
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: ['test', 'john-doe']
            },
            true
        ],
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: ['john-doe']
            },
            false
        ],

        // JSON encoded
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: '["test", "john-doe"]'
            },
            true
        ],
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: '["john-doe"]'
            },
            false
        ],

        // Legacy value string to split
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: 'test,john-doe'
            },
            true
        ],
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: 'john-doe'
            },
            false
        ],
        // Fails because the value is split in middle
        [
            {
                property: '$.identity.identifier',
                operator: CONDITION_OPERATORS.IN,
                value: 'te,st,john-doe'
            },
            false
        ],

        // Edge cases
        [{ property: '$.identity.identifier', operator: CONDITION_OPERATORS.IN, value: '' }, false],
        [{ property: '$.identity.identifier', operator: CONDITION_OPERATORS.IN, value: [] }, false],
        [
            { property: '$.identity.identifier', operator: CONDITION_OPERATORS.IN, value: '[]' },
            false
        ]
    ] as Array<[SegmentCondition | InSegmentCondition, boolean]>)(
        'evaluates IN condition %j to %s',
        (condition: SegmentCondition | InSegmentCondition, expected: boolean) => {
            const result = traitsMatchSegmentCondition(condition, 'segment', mockContext);
            expect(result).toBe(expected);
        }
    );
});

describe('evaluateIdentityInSegment', () => {
    const mockContext: EvaluationContext = {
        environment: { key: 'env', name: 'test' },
        identity: { key: 'user', identifier: 'test@example.com', traits: { age: 25 } },
        segments: {},
        features: {}
    };

    test('returns false for segment with no rules', () => {
        const segment: SegmentContext = {
            key: '1',
            name: 'empty_segment',
            rules: [],
            overrides: []
        };

        expect(evaluateIdentityInSegment(segment, mockContext)).toBe(false);
    });

    test('returns true when all rules match', () => {
        const segment: SegmentContext = {
            key: '1',
            name: 'matching_segment',
            rules: [
                {
                    type: 'ALL',
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'EQUAL',
                            value: 'test@example.com'
                        }
                    ]
                },
                {
                    type: 'ALL',
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'CONTAINS',
                            value: 'test@example.com'
                        }
                    ]
                }
            ],
            overrides: []
        };

        expect(evaluateIdentityInSegment(segment, mockContext)).toBe(true);
    });

    test('returns false when any rule fails', () => {
        const segment: SegmentContext = {
            key: '1',
            name: 'failing_segment',
            rules: [
                {
                    type: 'ALL',
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'EQUAL',
                            value: 'test@example.com'
                        }
                    ]
                },
                {
                    type: 'ALL',
                    conditions: [{ property: 'age', operator: 'EQUAL', value: '30' }]
                }
            ],
            overrides: []
        };

        expect(evaluateIdentityInSegment(segment, mockContext)).toBe(false);
    });
});

describe('getContextValue', () => {
    const mockContext: EvaluationContext = {
        environment: {
            key: 'test-env-key',
            name: 'Test Environment'
        },
        identity: {
            key: 'user-123',
            identifier: 'user@example.com'
        },
        segments: {},
        features: {}
    };

    // Success cases
    test.each([
        ['$.identity.identifier', 'user@example.com'],
        ['$.environment.name', 'Test Environment'],
        ['$.environment.key', 'test-env-key']
    ])('returns correct value for path %s', (jsonPath, expected) => {
        const result = getContextValue(jsonPath, mockContext);
        expect(result).toBe(expected);
    });

    // Undefined or invalid cases
    test.each([
        ['$.identity.traits.user_type', 'unsupported nested path'],
        ['identity.identifier', 'missing $ prefix'],
        ['$.invalid.path', 'completely invalid path'],
        ['$.identity.nonexistent', 'valid structure but missing property'],
        ['', 'empty string'],
        ['$', 'just $ symbol']
    ])('returns undefined for %s (%s)', jsonPath => {
        const result = getContextValue(jsonPath, mockContext);
        expect(result).toBeUndefined();
    });

    // Context error cases
    test.each([
        [undefined, '$.identity.identifier', 'undefined context'],
        [{ segments: {}, features: {} }, '$.identity.identifier', 'missing identity'],
        [
            { identity: { key: 'test', identifier: 'test' }, segments: {}, features: {} },
            '$.environment.name',
            'missing environment'
        ]
    ])('returns undefined when %s', (context, jsonPath, _) => {
        const result = getContextValue(jsonPath, context as EvaluationContext);
        expect(result).toBeUndefined();
    });
});

describe('percentage split operator', () => {
    const mockContext: EvaluationContext = {
        environment: { key: 'env', name: 'Test Env' },
        identity: {
            key: 'user-123',
            identifier: 'test@example.com',
            traits: {
                age: 25,
                subscription: 'premium',
                active: true
            }
        },
        segments: {},
        features: {}
    };
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each([
        [25.5, 30, true],
        [25.5, 20, false],
        [25.5, 25.5, true],
        [0, 0, true],
        [100, 99.9, false]
    ])('percentage %d with threshold %d returns %s', (hashedValue, threshold, expected) => {
        const mockHashFn = getHashedPercentageForObjIds;
        mockHashFn.mockReturnValue(hashedValue);
        const condition = {
            property: 'any',
            operator: 'PERCENTAGE_SPLIT',
            value: threshold.toString()
        } as SegmentCondition1 | InSegmentCondition;
        const result = traitsMatchSegmentCondition(condition, 'seg1', mockContext);

        expect(result).toBe(expected);
        expect(getHashedPercentageForObjIds).toHaveBeenCalledWith(['seg1', 'user-123']);
    });
});
