import {Router}  from 'express'
import Flagsmith from '../../../../build'

const environmentKey = 'NowEDzKzNJXZVTVanLVdMQ';

const flagsmith = new Flagsmith({
    environmentKey
});

const api =  () => {
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

export default api
