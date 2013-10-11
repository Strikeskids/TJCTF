var express = require('express');
var http = require('http');
var jade = require('jade');
var path = require('path');

var statics = ['images','views','css','js']

var app = express();
var server = http.createServer(app);

app.engine('jade', jade.__express);

statics.forEach(function(route) {
	app.use('/'+route, express.static(path.join(__dirname, route)));
});
app.use(express.logger());

require('./routing.js')(app);