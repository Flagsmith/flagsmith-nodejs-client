import { getEvaluationResult } from '../../../flagsmith-engine/index.js';
import { Flags } from '../../../sdk/models.js';
import * as testData from '../engine-tests/engine-test-data/data/environment_n9fbf9h3v4fFgH3U3ngWhb.json';
import { EvaluationContext } from '../../../flagsmith-engine/evaluationContext/evaluationContext.types.js';

function extractTestCases(data: any): {
    response: any;
    context: EvaluationContext;
}[] {
    const test_data = data['test_cases'].map((test_case: any) => {
        return {
            context: test_case['context'],
            response: test_case['result']
        };
    });
    return test_data;
}

test('Test Engine', () => {
    const testCases = extractTestCases(testData);
    for (const testCase of testCases) {
        const engine_response = getEvaluationResult(testCase.context);
        const flags = Flags.fromEvaluationResult(engine_response);
        const sortedEngineFlags = flags
            .allFlags()
            .sort((a, b) => (a.featureName > b.featureName ? 1 : -1));

        const expectedFlags = testCase.response['flags'] || {};
        const sortedAPIFlags = Object.values(expectedFlags).sort((a: any, b: any) =>
            a.name > b.name ? 1 : -1
        ) as Flags[];

        expect(sortedEngineFlags.length).toBe(sortedAPIFlags.length);

        for (let i = 0; i < sortedEngineFlags.length; i++) {
            expect(sortedEngineFlags[i].value).toBe(sortedAPIFlags[i].value);
            expect(sortedEngineFlags[i].enabled).toBe(sortedAPIFlags[i]['enabled']);
        }
    }
});
