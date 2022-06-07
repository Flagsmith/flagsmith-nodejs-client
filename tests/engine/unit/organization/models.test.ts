import { buildOrganizationModel } from '../../../../flagsmith-engine/organisations/util';

test('Test builder', () => {
    const model = buildOrganizationModel({
        persist_trait_data: true,
        name: 'Flagsmith',
        feature_analytics: false,
        stop_serving_flags: false,
        id: 13
    });
    expect(model.uniqueSlug).toBe('13-Flagsmith');
});
