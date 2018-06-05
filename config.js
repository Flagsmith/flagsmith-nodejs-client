/**
 * Created by kylejohnson on 02/10/2016.
 * Global config
 */
const fs = require('fs');
const env = process.env.config;
switch (env) {
    default: {
        config = require('./env/config-local');
    }
}

module.exports = config;