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
app.use('/api', api());

app.server.listen(PORT);
console.log('Server started on port ' + app.server.address().port);
console.log();
console.log('Go to http://localhost:' + PORT + '/api');
console.log('To get an example response for getFlags');
console.log();
console.log('Go to http://localhost:' + PORT + '/api/flagsmith_sample_user');
console.log('To get an example feature state for a user');
console.log();
console.log('Go to http://localhost:' + PORT + '/api/flagsmith_sample_user/segments');
console.log('To get the segments which the user belongs to');

module.exports = app;
