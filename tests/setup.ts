import { fetch as mockFetch, fetchImpl } from './sdk/fetchMock.js';

beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(fetchImpl);
});
