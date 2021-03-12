const fetch = require('node-fetch').default;
const core = require('./flagsmith-core');
const flagsmith = core({fetch: fetch});

module.exports = flagsmith;
