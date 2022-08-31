const Router = require('express').Router;
const Flagsmith = require('flagsmith-nodejs');
const environmentKey = '';

const nodecache = require("node-cache");

if (!environmentKey) {
    throw new Error(
        'Please generate a Server Side SDK Key in environment settings to run the example'
    );
}
const flagsmith = new Flagsmith({
    environmentKey,
    enableLocalEvaluation: true,
    cache: new nodecache({
        stdTTL: 10,
        checkperiod: 10,
    }),
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

    api.get('/:user/segments', async (req, res) => {
        const segments = await flagsmith.getIdentitySegments(req.params.user, { checkout_v2: 1 });
        res.json(segments.map(v => v.name));
    });

    return api;
};
