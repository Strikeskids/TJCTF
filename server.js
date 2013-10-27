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
	if ('uid' in req.signedCookies) {
		db.getUser(req.signedCookies.uid, function(user) {
			if (user) {
				setUser(res, user.id);
				res.locals.user = user;
				next();
			}
		});
	} else {
		next();
	}
});

var setUser = function(res, user) {
	if (user) {
		var value = typeof user === 'number' || typeof user === 'string' ? user : user.id;
		res.cookie('uid', value, {signed: true});
	}
};

app.get('/', function(req, res) {
	res.render('index.jade');
});

//Problem related stuff

app.get('/problems', function(req, res) {
	db.getProblems(function(problems) {
		res.locals.problems = problems;
		if (res.locals.user) {
			db.getInteractions(res.locals.user.id, function(interactions) {
				res.locals.interactions = interactions;
				res.render('list.jade');
			});
		} else {
			res.render('list.jade');
		}
	});
});

app.get('/problems/:problemid', function(req, res) {
	db.getProblem(req.params.problemid, function(problem) {
		if (problem) {
			res.render('problem.jade', {
				problem: problem
			});
		} else {
			res.redirect('/problems');
		}
	});
});
app.post('/problems/:problemid', function(req, res) {
	if ('problemid' in req.body && 'answer' in req.body) {
		db.checkProblem(req.body.problemid, req.body.answer, function(err, correct, problem) {
			if (problem) {
				res.locals.answer = req.body.answer;
				res.locals.problem = problem;
				res.locals.correct = correct;
				res.render('problem.jade');
			} else {
				res.redirect('/problems');
			}
		});
	} else {
		req.redirect('/problems');
	}
});

//User related stuff
app.get('/login', function(req, res) {
	if (res.locals.user) {
		res.redirect('/');
	} else {
		res.render('login.jade');
	}
});
app.post('/login', function(req, res) {
	if ('username' in req.body && 'password' in req.body) {
		db.login(req.body.username, req.body.password, function(user) {
			setUser(res, user);
			res.redirect('/');
		});
	} else {
		res.redirect('/');
	}
});

app.get('/logout', function(req, res) {
	res.clearCookie('uid');
	res.redirect('/');
});

app.listen(4000);