import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEvaluationResult } from '../../../flagsmith-engine/index.js';
import { Flags } from '../../../sdk/models.js';
import { EvaluationContext } from '../../../flagsmith-engine/evaluation/evaluationContext/evaluationContext.types.js';
import { parse as parseJsonc } from 'jsonc-parser';
import { EvaluationResult } from '../../../flagsmith-engine/evaluation/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '../engine-tests/engine-test-data/test_cases');
interface TestCase {
    context: EvaluationContext;
    result: EvaluationResult;
}

function getTestFiles(): string[] {
    const files = fs.readdirSync(TEST_DATA_DIR);
    return files
        .filter(f => f.endsWith('.json') || f.endsWith('.jsonc'))
        .map(f => path.join(TEST_DATA_DIR, f));
}

function loadTestFile(filePath: string): TestCase {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseJsonc(content);
}

describe('Engine Integration Tests', () => {
    const testFiles = getTestFiles();

    if (testFiles.length === 0) {
        throw new Error(`No test files found in ${TEST_DATA_DIR}`);
    }

    testFiles.forEach(filePath => {
        const testName = path.basename(filePath, path.extname(filePath));

        test(testName, () => {
            const testCase = loadTestFile(filePath);
            const engine_response = getEvaluationResult(testCase.context);
            expect(engine_response).toStrictEqual(testCase.result);
        });
    });
});
