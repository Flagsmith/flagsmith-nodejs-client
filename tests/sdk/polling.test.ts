import Flagsmith from '../../sdk/index.js';
import { EnvironmentDataPollingManager } from '../../sdk/polling_manager.js';
import { delay } from '../../sdk/utils.js';
vi.mock('../../sdk');

test('test_polling_manager_correctly_stops_if_never_started', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.stop();
    expect(flagsmith.updateEnvironment).not.toHaveBeenCalled();
});

test('test_polling_manager_calls_update_environment_on_start', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.start();
    await delay(500);
    pollingManager.stop();
    expect(flagsmith.updateEnvironment).toHaveBeenCalled();
});

test('test_polling_manager_handles_double_start', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.start();
    await delay(100);
    pollingManager.start();
    await delay(500);
    pollingManager.stop();
    expect(flagsmith.updateEnvironment).toHaveBeenCalled();
});


test('test_polling_manager_calls_update_environment_on_each_refresh', async () => {
    const flagsmith = new Flagsmith({
        environmentKey: 'key'
    });

    const pollingManager = new EnvironmentDataPollingManager(flagsmith, 0.1);
    pollingManager.start();
    await delay(450);
    pollingManager.stop();
    expect(flagsmith.updateEnvironment).toHaveBeenCalledTimes(4);
});
