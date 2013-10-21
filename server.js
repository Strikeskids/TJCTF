var express = require('express');
var http = require('http');
var jade = require('jade');
var path = require('path');
var db = require('./database');

var app = express();
var server = http.createServer(app);

app.engine('jade', jade.__express);

app.use(express.static(__dirname + '/public'));
app.use(express.logger());

app.use(express.json());
app.use(express.urlencoded());

app.use(express.cookieParser('my secret string (maybe generate this)'))
app.use(function(req, res, next) {
	// REMOVE this
	req.signedCookies.uid = 1;
	if ('uid' in req.signedCookies) {
		res.cookie('uid', req.signedCookies.uid, {secure: true});
		res.locals.user = db.getUser(req.signedCookies.uid);
	}
	next();
});

app.get('/', function(req, res) {
	console.log(res.locals.user);
	res.render('index.jade');
});

app.get('/problems', function(req, res) {
	res.render('list.jade', {
		problems: db.getProblems()
	});
});

app.get('/problems/:problemid', function(req, res) {
	problem = db.getProblem(req.params.problemid);
	if (problem) {
		res.render('problem.jade', {
			problem: db.getProblem(req.params.problemid)
		});
	} else {
		res.redirect('/problems');
	}
});
app.post('/problems/:problemid', function(req, res) {
	if ('problemid' in req.body && 'answer' in req.body) {
		problem = db.getProblem(parseInt(req.params.problemid=;…“‘æ));
		if (!problem) {
			res.redirect('/problems');
			return;
		}
		correct = shasum(req.body.answer) === problem.answer;
		res.location('/problems' + problem.id);
		if (res.locals.user) {
			// TODO do user points
		}
		res.locals({
			correct: correct,
			answer: req.body.answer,
			problem: problem
		});
		res.render('problem.jade');
	} else {
		req.redirect('/problems');
	}
});

app.get('/logout', function(req, res) {
	res.cookie('uid', null);
	res.locals.user = null;
	res.redirect('/');
});

app.listen(4000);