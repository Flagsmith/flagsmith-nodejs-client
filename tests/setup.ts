import { fetch as mockFetch, fetchImpl } from './sdk/fetchMock.js';

beforeEach(() => {
    mockFetch.mockImplementation(fetchImpl);
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) =>
        mockFetch(url.toString(), options)
    );
});
