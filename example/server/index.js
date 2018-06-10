global.fetch = require('fetchify')(Promise).fetch; // polyfil

const http = require('http');
const express = require('express');
const api = require('./api');
const PORT = process.env.PORT || 3000;
const app = express();
const bodyParser = require('body-parser');

app.server = http.createServer(app);

//Apply middleware
// parse various different custom JSON types as JSON
app.use(bodyParser.json());

// api router
app.use('/', api());


app.server.listen(PORT);
console.log('Server started on port ' + app.server.address().port);
console.log();
console.log('Go to http://localhost:'+PORT+'/');
console.log('To get an example feature state');
console.log();
console.log('Go to http://localhost:'+PORT+'/bullet_train_sample_user');
console.log('To get an example feature state for a user');

module.exports = app;
