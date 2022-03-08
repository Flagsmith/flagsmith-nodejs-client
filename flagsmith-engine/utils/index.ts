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
