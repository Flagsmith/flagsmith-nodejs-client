import { FeatureStateModel } from '../features/models';

export class IdentityFeaturesList extends Array<FeatureStateModel> {
    public push(...e: FeatureStateModel[]): number {
        for (const [_, item] of e.entries()) {
            for (const [k, v] of this.entries()) {
                if (v.djangoID === item.djangoID) {
                    throw new Error('feature state for this feature already exists');
                }
            }
        }
        return super.push(...e);
    }
}
