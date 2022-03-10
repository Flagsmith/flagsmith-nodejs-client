import { Flagsmith } from '../../sdk';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager';
jest.mock('../../sdk');
jest.mock('node-fetch');

beforeEach(() => {
    // @ts-ignore
    Flagsmith.mockClear();
});

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

test('test_polling_manager_calls_update_environment_on_start', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.start();
    await sleep(500);
    pollingManager.stop();
    expect(flagsmith.update_environment).toHaveBeenCalled();
});

test('test_polling_manager_calls_update_environment_on_each_refresh', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.start();
    await sleep(450);
    pollingManager.stop();
    expect(flagsmith.update_environment).toHaveBeenCalledTimes(3);
});
