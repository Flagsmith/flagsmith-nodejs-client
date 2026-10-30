import { ALL_RULE, CONDITION_OPERATORS } from '../../../../flagsmith-engine/segments/constants.js';

import {
    traitsMatchSegmentCondition,
    getContextValue,
    isContextInSegment
} from '../../../../flagsmith-engine/segments/evaluators.js';
import { TraitModel } from '../../../../flagsmith-engine/index.js';
import { getHashedPercentageForObjIds } from '../../../../flagsmith-engine/utils/hashing/index.js';
import {
    EvaluationContext,
    InSegmentCondition,
    SegmentCondition,
    SegmentCondition1
} from '../../../../flagsmith-engine/evaluation/models.js';

const isEsmBuild = process.env.ESM_BUILD === 'true';

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

describe('isContextInSegment', () => {
    const baseContext: EvaluationContext = {
        environment: { key: 'env', name: 'test' },
        identity: { key: 'user', identifier: 'test@example.com', traits: { age: 25 } },
        segments: {},
        features: {}
    };

    test('does not match a segment with no rules', () => {
        const segment = {
            key: '1',
            name: 'empty_segment',
            rules: [],
            overrides: []
        };

        expect(isContextInSegment(baseContext, segment)).toBe(false);
    });

    test('matches a segment when all rules match', () => {
        const segment = {
            key: '1',
            name: 'matching_segment',
            rules: [
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'EQUAL',
                            value: 'test@example.com'
                        }
                    ],
                    rules: []
                },
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'CONTAINS',
                            value: 'test@example.com'
                        }
                    ],
                    rules: []
                }
            ],
            overrides: []
        };

        expect(isContextInSegment(baseContext, segment)).toBe(true);
    });

    test('does not match a segment when any rule fails', () => {
        const segment = {
            key: '1',
            name: 'failing_segment',
            rules: [
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            property: '$.identity.identifier',
                            operator: 'EQUAL',
                            value: 'test@example.com'
                        }
                    ],
                    rules: []
                },
                {
                    type: ALL_RULE,
                    conditions: [{ property: 'age', operator: 'EQUAL', value: '30' }],
                    rules: []
                }
            ],
            overrides: []
        };

        expect(isContextInSegment(baseContext, segment)).toBe(false);
    });
});

describe('traitsMatchSegmentCondition with $.identity.traits.* properties', () => {
    const mockContext: EvaluationContext = {
        environment: { key: 'env', name: 'test' },
        identity: {
            key: 'user',
            identifier: 'user@example.com',
            traits: {
                age: 25,
                tamaño: 'grande',
                サイズ: 'medium',
                '[$the.size$]': 'small',
                'my.foo.bar': 'dotted'
            }
        },
        segments: {},
        features: {}
    };

    test.each([
        // dot notation – normal trait name
        [{ property: '$.identity.traits.age', operator: 'EQUAL', value: '25' }, true],
        [{ property: '$.identity.traits.age', operator: 'EQUAL', value: '30' }, false],
        // dot notation – unicode trait name
        [{ property: '$.identity.traits.tamaño', operator: 'EQUAL', value: 'grande' }, true],
        [{ property: '$.identity.traits.サイズ', operator: 'EQUAL', value: 'medium' }, true],
        // dot notation – trait name that itself contains dots (everything after $.identity.traits. is the key)
        [{ property: '$.identity.traits.my.foo.bar', operator: 'EQUAL', value: 'dotted' }, true],
        [{ property: '$.identity.traits.my.foo.bar', operator: 'EQUAL', value: 'other' }, false],
        // bracket notation – special characters in trait name that break jsonpath-plus
        [
            { property: "$.identity.traits['[$the.size$]']", operator: 'EQUAL', value: 'small' },
            true
        ],
        [
            { property: "$.identity.traits['[$the.size$]']", operator: 'EQUAL', value: 'large' },
            false
        ],
        // non-existent trait
        [{ property: '$.identity.traits.nonexistent', operator: 'EQUAL', value: 'any' }, false],
        // IS_SET / IS_NOT_SET
        [{ property: '$.identity.traits.age', operator: 'IS_SET', value: null }, true],
        [{ property: '$.identity.traits.nonexistent', operator: 'IS_SET', value: null }, false],
        [{ property: '$.identity.traits.nonexistent', operator: 'IS_NOT_SET', value: null }, true],
        [{ property: '$.identity.traits.age', operator: 'IS_NOT_SET', value: null }, false],
        // IN operator
        [
            {
                property: '$.identity.traits.tamaño',
                operator: CONDITION_OPERATORS.IN,
                value: ['grande', 'pequeño']
            },
            true
        ],
        [
            {
                property: '$.identity.traits.tamaño',
                operator: CONDITION_OPERATORS.IN,
                value: ['pequeño']
            },
            false
        ]
    ] as Array<[SegmentCondition | InSegmentCondition, boolean]>)(
        'evaluates %j to %s',
        (condition, expected) => {
            expect(traitsMatchSegmentCondition(condition, 'seg', mockContext)).toBe(expected);
        }
    );
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
            // intentionally no traits – tests below confirm paths that require traits return undefined
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
        ['$.identity.traits.user_type', 'no traits in context'],
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

// Skip in ESM build: vi.mock doesn't work with external modules
describe.skipIf(isEsmBuild)('percentage split operator', () => {
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
            operator: 'PERCENTAGE_SPLIT',
            value: threshold.toString()
        } as SegmentCondition1 | InSegmentCondition;
        const result = traitsMatchSegmentCondition(condition, 'seg1', mockContext);

        expect(result).toBe(expected);
        expect(getHashedPercentageForObjIds).toHaveBeenCalledWith(['seg1', 'user-123']);
    });
});
