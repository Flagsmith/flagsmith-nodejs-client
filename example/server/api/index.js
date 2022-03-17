const Router = require('express').Router;
const Flagsmith = require('../../../build');
const environmentKey = '';
if (!environmentKey) {
    throw new Error(
        'Please generate a Server Side SDK Key in environment settings to run the example'
    );
}
const flagsmith = new Flagsmith({
    environmentKey,
    enableLocalEvaluation: true,
    defaultFlagHandler: str => {
        return { enabled: false, isDefault: true, value: null };
    }
});

module.exports = () => {
    const api = Router();

    api.get('/', async (req, res) => {
        const flags = await flagsmith.getEnvironmentFlags();
        res.json(flags);
    });

    api.get('/:user', async (req, res) => {
        const flags = await flagsmith.getIdentityFlags(req.params.user, { checkout_v2: 1 });
        const fontSize = flags.getFeatureValue('font_size');
        const checkoutV2 = flags.isFeatureEnabled('checkout_v2');
        res.json({ fontSize, checkoutV2 });
    });

    return api;
};
