const Router = require('express').Router;
const environmentID = 'uCDQzKWgejrutqSYYsKWen';
const flagsmith = require('../../../');
const NodeCache = require('node-cache');

flagsmith.init({
    environmentID
    /*cache: new NodeCache({
        stdTTL: 5
    })*/
});

module.exports = () => {
    const api = Router();

    api.get('/', async (req, res) => {
        const font_size = await flagsmith.getValue('font_size');
        res.json({ font_size });
    });

    api.get('/flags', async (req, res) => {
        const flags = await flagsmith.getFlags();
        res.json(flags);
    });

    api.get('/:user', async (req, res) => {
        const font_size = await flagsmith.getValue('font_size', req.params.user);
        res.json({ font_size });
    });

    return api;
};
