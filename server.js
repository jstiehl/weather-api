//Libraries
var express = require('express');
var app = express();
var bodyparser = require('body-parser');
var router = express.Router();

//configuration
var config = require('./config');

//routes
var routes = require('./routes/routes.js')(router);

app.use(bodyparser.json({}));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(config.server.prefix, routes);

app.listen(config.server.port);
console.log("Server listening on port " + config.server.port);
