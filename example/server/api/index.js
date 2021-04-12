const Router = require('express').Router;
const environmentID = 'uCDQzKWgejrutqSYYsKWen';
const flagsmith = require('flagsmith-nodejs');

flagsmith.init({
    environmentID
});

module.exports = () => {
    const api = Router();

    api.get('/', (req, res) => {
        flagsmith.getValue('font_size').then(font_size => {
            res.json({ font_size });
        });
    });

    api.get('/flags', (req, res) => {
        flagsmith.getFlags().then(flags => {
            res.json(flags);
        });
    });

    api.get('/:user', (req, res) => {
        flagsmith.getValue('font_size', 'flagsmith_sample_user').then(font_size => {
            res.json({ font_size });
        });
    });

    return api;
};
