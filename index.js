const fetch = require('node-fetch').default;
const core = require('./flagsmith-core');
const flagsmith = core({ fetch });

module.exports = flagsmith;
