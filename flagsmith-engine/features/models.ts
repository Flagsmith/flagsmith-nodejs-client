import { v4 as uuidv4 } from 'uuid';
import { getHashedPercentateForObjIds } from '../utils/hashing';

export class FeatureModel {
    id: number;
    name: string;
    type: string;

    constructor(id: number, name: string, type: string) {
        this.id = id;
        this.name = name;
        this.type = type;
    }

    eq(other: FeatureModel) {
        return !!other && this.id === other.id;
    }
}

export class MultivariateFeatureOptionModel {
    value: any;
    id: number | undefined;

    constructor(value: any, id?: number) {
        this.value = value;
        this.id = id;
    }
}

export class MultivariateFeatureStateValueModel {
    multivariateFeatureOption: MultivariateFeatureOptionModel;
    percentageAllocation: number;
    id: number;
    mvFsValueUuid: string = uuidv4();

    constructor(
        multivariate_feature_option: MultivariateFeatureOptionModel,
        percentage_allocation: number,
        id: number,
        mvFsValueUuid?: string
    ) {
        this.id = id;
        this.percentageAllocation = percentage_allocation;
        this.multivariateFeatureOption = multivariate_feature_option;
        this.mvFsValueUuid = mvFsValueUuid || this.mvFsValueUuid;
    }
}

export class FeatureStateModel {
    feature: FeatureModel;
    enabled: boolean;
    djangoID: number;
    featurestateUUID: string = uuidv4();
    _value: any;
    multivariateFeatureStateValues: MultivariateFeatureStateValueModel[] = [];

    constructor(
        feature: FeatureModel,
        enabled: boolean,
        djangoID: number,
        value?: any,
        featurestate_uuid: string = uuidv4()
    ) {
        this.feature = feature;
        this.enabled = enabled;
        this.djangoID = djangoID;
        this._value = value;
        this.featurestateUUID = featurestate_uuid;
    }

    setValue(value: any) {
        this._value = value;
    }

    getValue(identityId?: number | string) {
        if (!!identityId && this.multivariateFeatureStateValues.length > 0) {
            return this.getMultivariateValue(identityId);
        }
        return this._value;
    }

    get_feature_state_value() {
        return this.getValue();
    }

    getMultivariateValue(identityID: number | string) {
        const percentageValue = getHashedPercentateForObjIds([
            this.djangoID || this.featurestateUUID,
            identityID
        ]);

        let startPercentage = 0;
        const sortedF = this.multivariateFeatureStateValues.sort((a, b) =>
            !!(a.id && b.id) ? a.id - b.id : a.mvFsValueUuid > b.mvFsValueUuid ? -1 : 1
        );
        for (const myValue of sortedF) {
            const limit = myValue.percentageAllocation + startPercentage;
            if (startPercentage <= percentageValue && percentageValue < limit) {
                return myValue.multivariateFeatureOption.value;
            }
            startPercentage = limit;
        }
        return this._value;
    }
}
