import { fetch as mockFetch, fetchImpl } from './sdk/fetchMock.js';

beforeEach(() => {
    mockFetch.mockImplementation(fetchImpl);
});
