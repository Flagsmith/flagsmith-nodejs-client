import { FeatureSegment } from "../features/models";

export function getCastingFunction(input: any): CallableFunction {
    switch (typeof input) {
        case 'boolean':
            return (x: any) => !['False', 'false'].includes(x);
        case 'number':
            return (x: any) => parseFloat(x);
        default:
            return (x: any) => String(x);
    }
}

// export function filterFeatureSegments(featureSegments: FeatureSegment[], environmentApiKey: string): FeatureSegment[] {
//     return featureSegments.filter(fs => fs.environment === environmentApiKey);
// }