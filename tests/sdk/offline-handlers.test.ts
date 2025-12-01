import * as fs from 'fs';
import { LocalFileHandler } from '../../sdk/offline_handlers.js';
import { EnvironmentModel } from '../../flagsmith-engine/index.js';

import * as offlineEnvironment from './data/offline-environment.json';

vi.mock('fs');

const offlineEnvironmentString = JSON.stringify(offlineEnvironment);
const isEsmBuild = process.env.ESM_BUILD === 'true';

// Skip in ESM build: instanceof fails across module boundaries
test.skipIf(isEsmBuild)('local file handler', () => {
    const environmentDocumentFilePath = '/some/path/environment.json';

    // Mock the fs.readFileSync function to return environmentJson

    const readFileSyncMock = vi.spyOn(fs, 'readFileSync');
    readFileSyncMock.mockImplementation(() => offlineEnvironmentString);

    // Given
    const localFileHandler = new LocalFileHandler(environmentDocumentFilePath);

    // When
    const environmentModel = localFileHandler.getEnvironment();

    // Then
    expect(environmentModel).toBeInstanceOf(EnvironmentModel);
    expect(environmentModel.apiKey).toBe('B62qaMZNwfiqT76p38ggrQ');
    expect(readFileSyncMock).toHaveBeenCalledWith(environmentDocumentFilePath, 'utf8');

    // Restore the original implementation of fs.readFileSync
    readFileSyncMock.mockRestore();
});
