export function generate_identities_data(identifier: string, traits?: { [key: string]: any }) {
    const traitsGenerated = Object.values(traits || {}).map(trait => ({
        trait_key: trait[0],
        trait_value: trait[1]
    }));
    return {
        identifier: identifier,
        traits: traitsGenerated
    };
}
