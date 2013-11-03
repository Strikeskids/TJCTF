var express = require('express');
var http = require('http');
var jade = require('jade');
var path = require('path');
var crypto = require('crypto');
var db = require('./database');

var shasum = function(input) {
	return crypto.createHash('sha1').update(input).digest('hex');
};

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

app.get('/problems/create', function(req, res) {
	if (!res.locals.user || !res.locals.user.admin) {
		res.redirect('/problems');
		return;
	}
	res.render('createproblem.jade');
});

app.post('/problems/create', function(req, res) {
	if (!res.locals.user || !res.locals.user.admin) {
		res.redirect('/problems');
	}
	res.locals.prev = req.body;
	var data = req.body;
	data.author = res.locals.user.username;
	db.addProblem(data, function(response) {
		if (typeof response === 'boolean') {
			res.redirect('/problems');
		} else {
			res.render('createproblem.jade', { failed: response });
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
		db.checkProblem(req.signedCookies.uid, req.body.problemid, req.body.answer, function(correct, problem) {
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



app.get('/scores', function(req, res) {
	db.getHighscores(function(users) {
		res.render('scores.jade', { users: users });
	});
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
			if (user) {
				setUser(res, user);
				res.redirect('/');
			} else {
				res.render('login.jade', { failed: true });
			}
		});
	} else {
		res.redirect('/');
	}
});

app.get('/logout', function(req, res) {
	res.clearCookie('uid');
	res.redirect('/');
});

var captchaOps = [
	{
		text: ['times', 'multiplied by'],
		perf: function(a, b) { return a * b; }
	},
	{
		text: ['minus', 'subtracted by'],
		perf: function(a, b) { return a - b; }
	}, 
	{
		text: ['plus', 'added to', 'and'],
		perf: function(a, b) { return a + b; }
	}
];

var generateCaptcha = function() {
	var max = 12;
	var a = Math.floor(Math.random() * max), b = Math.floor(Math.random() * max);
	var op = captchaOps[Math.floor(Math.random() * captchaOps.length)];
	var ans = shasum('captcha' + op.perf(a, b).toString());
	return {
		question: 'What is '+a+' '+op.text[Math.floor(Math.random() * op.text.length)]+' '+b+'?',
		answer: ans
	};
};

app.get('/register', function(req, res) {
	res.render('register.jade', {
		captcha: generateCaptcha()
	});
});

app.post('/register', function(req, res) {
	res.locals.prev = req.body;
	db.addUser(req.body, function(response) {
		if (typeof response === 'boolean') {
			res.redirect('/');
		} else {
			res.render('register.jade', {
				failed: response,
				captcha: generateCaptcha()
			});
		}
	});
});

app.listen(4000);