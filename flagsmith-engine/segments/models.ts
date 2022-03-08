import { FeatureStateModel } from '../features/models';
import { getCastingFunction as getCastingFunction } from '../utils';
import {
    ALL_RULE,
    ANY_RULE,
    NONE_RULE,
    NOT_CONTAINS,
    REGEX,
    CONDITION_OPERATORS
} from './constants';

export const all = (iterable: Array<any>) => iterable.filter(e => !!e).length === iterable.length;
export const any = (iterable: Array<any>) => iterable.filter(e => !!e).length > 0;

export const matchingFunctions = {
    [CONDITION_OPERATORS.EQUAL]: (thisValue: any, otherValue: any) => thisValue == otherValue,
    [CONDITION_OPERATORS.GREATER_THAN]: (thisValue: any, otherValue: any) => otherValue > thisValue,
    [CONDITION_OPERATORS.GREATER_THAN_INCLUSIVE]: (thisValue: any, otherValue: any) =>
        otherValue >= thisValue,
    [CONDITION_OPERATORS.LESS_THAN]: (thisValue: any, otherValue: any) => thisValue > otherValue,
    [CONDITION_OPERATORS.LESS_THAN_INCLUSIVE]: (thisValue: any, otherValue: any) =>
        thisValue >= otherValue,
    [CONDITION_OPERATORS.NOT_EQUAL]: (thisValue: any, otherValue: any) => thisValue != otherValue,
    [CONDITION_OPERATORS.CONTAINS]: (thisValue: any, otherValue: any) =>
        otherValue.includes(thisValue),
    [CONDITION_OPERATORS.NOT_CONTAINS]: (thisValue: any, otherValue: any) =>
        !otherValue.includes(thisValue)
};

export class SegmentConditionModel {
    EXCEPTION_OPERATOR_METHODS: { [key: string]: string } = {
        [NOT_CONTAINS]: 'evaluateNotContains',
        [REGEX]: 'evaluateRegex'
    };

    operator: string;
    value: string;
    property_: string | undefined;

    constructor(operator: string, value: string, property?: string) {
        this.operator = operator;
        this.value = value;
        this.property_ = property;
    }

    matchesTraitValue(traitValue: any) {
        const evaluators: { [key: string]: CallableFunction } = {
            evaluateNotContains: (traitValue: any) => {
                return !traitValue.includes(this.value);
            },
            evaluateRegex: (traitValue: any) => {
                return !!traitValue.match(new RegExp(this.value));
            }
        };

        // TODO: move this logic to the evaluator module
        if (this.EXCEPTION_OPERATOR_METHODS[this.operator]) {
            const evaluatorFunction = evaluators[this.EXCEPTION_OPERATOR_METHODS[this.operator]];
            return evaluatorFunction(traitValue);
        }

        const defaultFunction = (x: any, y: any) => false;

        const matchingFunction = matchingFunctions[this.operator] || defaultFunction;

        const castToTypeOfTraitValue = getCastingFunction(traitValue);
        return matchingFunction(castToTypeOfTraitValue(this.value), traitValue);
    }
}

export class SegmentRuleModel {
    type: string;
    rules: SegmentRuleModel[] = [];
    conditions: SegmentConditionModel[] = [];

    constructor(type: string) {
        this.type = type;
    }

    static none(iterable: Array<any>) {
        return iterable.filter(e => !!e).length === 0;
    }

    matchingFunction(): CallableFunction {
        return {
            [ANY_RULE]: any,
            [ALL_RULE]: all,
            [NONE_RULE]: SegmentRuleModel.none
        }[this.type] as CallableFunction;
    }
}

export class SegmentModel {
    id: number;
    name: string;
    rules: SegmentRuleModel[] = [];
    featureStates: FeatureStateModel[] = [];

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }
}
