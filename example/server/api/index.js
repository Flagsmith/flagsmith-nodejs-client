const Router = require('express').Router;
const { Flagsmith } = require('../../../sdk');

const flagsmith = new Flagsmith({
    environmentKey: 'some-key'
});

module.exports = () => {
    const api = Router();

    api.get('/', async (req, res) => {
        const flags = await flagsmith.getEnvironmentFlags();
        res.json(flags);
    });

    api.get('/:user', async (req, res) => {
        const flags = await flagsmith.getIdentityFlags(req.params.user);
        const fontSize = flags.getFeatureValue('font_size');
        res.json({ fontSize });
    });

    return api;
};
