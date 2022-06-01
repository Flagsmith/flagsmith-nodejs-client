import { ALL_RULE, ANY_RULE, EQUAL } from '../../../../flagsmith-engine/segments/constants';
import { SegmentModel } from '../../../../flagsmith-engine/segments/models';
import { buildSegmentModel } from '../../../../flagsmith-engine/segments/util';

export const traitKey1 = 'email';
export const traitValue1 = 'user@example.com';

export const traitKey2 = 'num_purchase';
export const traitValue2 = '12';

export const traitKey_3 = 'date_joined';
export const traitValue3 = '2021-01-01';

export const emptySegment = new SegmentModel(1, 'empty_segment');

export const segmentSingleCondition = buildSegmentModel({
    id: 2,
    name: 'segment_one_condition',
    rules: [
        {
            type: ALL_RULE,
            conditions: [
                {
                    operator: EQUAL,
                    property_: traitKey1,
                    value: traitValue1
                }
            ]
        }
    ]
});

export const segmentMultipleConditionsAll = buildSegmentModel({
    id: 3,
    name: 'segment_multiple_conditions_all',
    rules: [
        {
            type: ALL_RULE,
            conditions: [
                {
                    operator: EQUAL,
                    property_: traitKey1,
                    value: traitValue1
                },
                {
                    operator: EQUAL,
                    property_: traitKey2,
                    value: traitValue2
                }
            ]
        }
    ]
});

export const segmentMultipleConditionsAny = buildSegmentModel({
    id: 4,
    name: 'segment_multiple_conditions_any',
    rules: [
        {
            type: ANY_RULE,
            conditions: [
                {
                    operator: EQUAL,
                    property_: traitKey1,
                    value: traitValue1
                },
                {
                    operator: EQUAL,
                    property_: traitKey2,
                    value: traitValue2
                }
            ]
        }
    ]
});

export const segmentNestedRules = buildSegmentModel({
    id: 5,
    name: 'segment_nested_rules_all',
    rules: [
        {
            type: ALL_RULE,
            rules: [
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            operator: EQUAL,
                            property_: traitKey1,
                            value: traitValue1
                        },
                        {
                            operator: EQUAL,
                            property_: traitKey2,
                            value: traitValue2
                        }
                    ]
                },
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            operator: EQUAL,
                            property_: traitKey_3,
                            value: traitValue3
                        }
                    ]
                }
            ]
        }
    ]
});

export const segmentConditionsAndNestedRules = buildSegmentModel({
    id: 6,
    name: 'segment_multiple_conditions_all_and_nested_rules',
    rules: [
        {
            type: ALL_RULE,
            conditions: [
                {
                    operator: EQUAL,
                    property_: traitKey1,
                    value: traitValue1
                }
            ],
            rules: [
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            operator: EQUAL,
                            property_: traitKey2,
                            value: traitValue2
                        }
                    ]
                },
                {
                    type: ALL_RULE,
                    conditions: [
                        {
                            operator: EQUAL,
                            property_: traitKey_3,
                            value: traitValue3
                        }
                    ]
                }
            ]
        }
    ]
});
