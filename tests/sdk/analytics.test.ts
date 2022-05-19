jest.mock('node-fetch');
import fetch from 'node-fetch';
import { analyticsProcessor } from './utils';

afterEach(() => {
    jest.clearAllMocks();
});

test('test_analytics_processor_track_feature_updates_analytics_data', () => {
    const aP = analyticsProcessor();
    aP.trackFeature(1);
    expect(aP.analyticsData[1]).toBe(1);

    aP.trackFeature(1);
    expect(aP.analyticsData[1]).toBe(2);
});

test('test_analytics_processor_flush_clears_analytics_data', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature(1);
    await aP.flush();
    expect(aP.analyticsData).toStrictEqual({});
});

test('test_analytics_processor_flush_post_request_data_match_ananlytics_data', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature(1);
    aP.trackFeature(2);
    await aP.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://testUrlanalytics/flags/', {
        body: '{"1":1,"2":1}',
        headers: { 'Content-Type': 'application/json', 'X-Environment-Key': 'test-key' },
        method: 'POST',
        timeout: 3
    });
});

jest.useFakeTimers()
test('test_analytics_processor_flush_post_request_data_match_ananlytics_data_test', async () => {
    const aP = analyticsProcessor();
    aP.trackFeature(1);
    setTimeout(() => {
        aP.trackFeature(2);
        expect(fetch).toHaveBeenCalledTimes(1);
    }, 15000);
    jest.runOnlyPendingTimers();
});

test('test_analytics_processor_flush_early_exit_if_analytics_data_is_empty', async () => {
    const aP = analyticsProcessor();
    await aP.flush();
    expect(fetch).not.toHaveBeenCalled();
});
