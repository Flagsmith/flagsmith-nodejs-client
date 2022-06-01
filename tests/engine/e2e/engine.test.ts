import { readFileSync } from 'fs';
import { getIdentityFeatureStates } from '../../../flagsmith-engine';
import { EnvironmentModel } from '../../../flagsmith-engine/environments/models';
import { buildEnvironmentModel } from '../../../flagsmith-engine/environments/util';
import { IdentityModel } from '../../../flagsmith-engine/identities/models';
import { buildIdentityModel } from '../../../flagsmith-engine/identities/util';

function extractTestCases(
    filePath: string
): {
    environment: EnvironmentModel;
    identity: IdentityModel;
    response: any;
}[] {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
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
    const testCases = extractTestCases(
        __dirname + '/../engine-tests/engine-test-data/data/environment_n9fbf9h3v4fFgH3U3ngWhb.json'
    );
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
