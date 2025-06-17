import { getIdentityFeatureStates } from '../../../flagsmith-engine/index.js';
import { EnvironmentModel } from '../../../flagsmith-engine/environments/models.js';
import { buildEnvironmentModel } from '../../../flagsmith-engine/environments/util.js';
import { IdentityModel } from '../../../flagsmith-engine/identities/models.js';
import { buildIdentityModel } from '../../../flagsmith-engine/identities/util.js';
import * as testData from '../engine-tests/engine-test-data/data/environment_n9fbf9h3v4fFgH3U3ngWhb.json';

function extractTestCases(data: any): {
    environment: EnvironmentModel;
    identity: IdentityModel;
    response: any;
}[] {
    const environmentModel = buildEnvironmentModel(data['environment']);
    const test_data = data['identities_and_responses'].map((test_case: any) => {
        const identity = buildIdentityModel(test_case['identity']);

        return {
            environment: environmentModel,
            identity: identity,
            response: test_case['response']
        };
    });
    return test_data;
}

test('Test Engine', () => {
    const testCases = extractTestCases(testData);
    for (const testCase of testCases) {
        const engine_response = getIdentityFeatureStates(testCase.environment, testCase.identity);
        const sortedEngineFlags = engine_response.sort((a, b) =>
            a.feature.name > b.feature.name ? 1 : -1
        );
        const sortedAPIFlags = testCase.response['flags'].sort((a: any, b: any) =>
            a.feature.name > b.feature.name ? 1 : -1
        );

        expect(sortedEngineFlags.length).toBe(sortedAPIFlags.length);

        for (let i = 0; i < sortedEngineFlags.length; i++) {
            expect(sortedEngineFlags[i].getValue(testCase.identity.djangoID)).toBe(
                sortedAPIFlags[i]['feature_state_value']
            );
            expect(sortedEngineFlags[i].enabled).toBe(sortedAPIFlags[i]['enabled']);
        }
    }
});
