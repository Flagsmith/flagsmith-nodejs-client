const config = require("./config");
const fetch = require('node-fetch').default;
const bt = require('./bullet-train-core');
const bulletTrain = bt({fetch: fetch});

module.exports = bulletTrain;
