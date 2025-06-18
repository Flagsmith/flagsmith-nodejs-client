import { analyticsProcessor, fetch } from './utils.js';

test('test_analytics_processor_track_feature_updates_analytics_data', () => {
    const aP = analyticsProcessor();
    aP.trackFeature('myFeature');
    expect(aP.analyticsData['myFeature']).toBe(1);

    aP.trackFeature('myFeature');
    expect(aP.analyticsData['myFeature']).toBe(2);
});

test('test_analytics_processor_flush_clears_analytics_data', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature('myFeature');
    await aP.flush();
    expect(aP.analyticsData).toStrictEqual({});
});

test('test_analytics_processor_flush_post_request_data_match_ananlytics_data', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature('myFeature1');
    aP.trackFeature('myFeature2');
    await aP.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://testUrl/analytics/flags/',
        expect.objectContaining({
            body: '{"myFeature1":1,"myFeature2":1}',
            headers: { 'Content-Type': 'application/json', 'X-Environment-Key': 'test-key' },
            method: 'POST'
        })
    );
});

vi.useFakeTimers();
test('test_analytics_processor_flush_post_request_data_match_ananlytics_data_test', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature('myFeature1');
    setTimeout(() => {
        aP.trackFeature('myFeature2');
        expect(fetch).toHaveBeenCalledTimes(1);
    }, 15000);
    vi.runOnlyPendingTimers();
});

test('test_analytics_processor_flush_early_exit_if_analytics_data_is_empty', async () => {
    const aP = analyticsProcessor();
    await aP.flush();
    expect(fetch).not.toHaveBeenCalled();
});

test('errors in fetch sending analytics data are swallowed', async () => {
    // Given
    // we mock the fetch function to throw and error to mimick a network failure
    fetch.mockRejectedValue('some error');

    // and create the processor and track a feature so there is some analytics data
    const processor = analyticsProcessor();
    processor.trackFeature('myFeature');

    // When
    // we flush the data to trigger the call to fetch
    await processor.flush();

    // Then
    // we expect that fetch was called but the exception was handled
    expect(fetch).toHaveBeenCalled();
});

test('analytics is only flushed once even if requested concurrently', async () => {
    const processor = analyticsProcessor();
    processor.trackFeature('myFeature');
    fetch.mockImplementation(() => {
        return new Promise((resolve, _) => {
            setTimeout(resolve, 1000);
        });
    });
    const flushes = Promise.all([processor.flush(), processor.flush()]);
    vi.runOnlyPendingTimers();
    await flushes;
    expect(fetch).toHaveBeenCalledTimes(1);
});
