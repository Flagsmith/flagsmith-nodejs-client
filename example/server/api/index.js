const Router = require('express').Router;
const environmentID = "QjgYur4LQTwe5HpvbvhpzK";
const bulletTrain = require("bullet-train-nodejs");

bulletTrain.init({
    environmentID
});

module.exports = () => {
    const api = Router();

    api.get('/', (req, res) => {
        bulletTrain.getValue("font_size")
            .then((font_size) => {
                res.json({font_size})
            });
    });

    api.get('/:user', (req, res) => {
        bulletTrain.getValue("font_size", "bullet_train_sample_user")
            .then((font_size) => {
                res.json({font_size})
            });
    });

    return api;
};