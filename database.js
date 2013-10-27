var util = require('util');
var redis = require('redis');
var crypto = require('crypto');
var bcrypt = require('bcrypt');

var shasum = function(input) {
	return crypto.createHash('sha1').update(input).digest('hex');
};

var db = function() {
};

// var rdb;
var rdb = redis.createClient(null, null);

var testProblem = {
	name: 'problem',
	date: new Date(),
	id: 0,
	points: 100,
	author: 'Strikeskids',
	statement: 'My test problem!!!',
	answer: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
};
var testUser = {
	username: 'Strikeskids',
	password: '$2a$12$EECy0Vupy86vhAfCJ4ei/eDTukWoSFoAnL1zp5B8iYd2O/3R98zs.',
	id: 1
};

var problems = {
	'0': testProblem
};

db.prototype.init = function() {
	
};

db.prototype.checkProblem = function(problemid, answer, callback) {
	this.getProblem(problemid, function(problem) {
		if (!problem) callback();
		var correct = shasum(answer) === problem.answer;
		if (correct) {
			// do user stuff
		}
		util.dispatch(callback, correct, problem);
	}.bind(this));
};

db.prototype.getProblem = function(problemid, callback) {
	util.dispatch(callback, testProblem);
};

db.prototype.getProblems = function(callback) {
	util.dispatch(callback, problems);
};

var getUserIdFromName = function(username, callback) {
	rdb.hget('users', username, function(err, value) {
		value = parseInt(value);
		if (!isNaN(value)) {
			util.dispatch(callback, value);
		}
		util.dispatch(callback);
	});
};

var getUserFromId = function(uid, callback) {
	rdb.hgetall('user:'+uid, function(err, reply) {
		if (reply) {
			util.dispatch(callback, reply);
		} else {
			util.dispatch(callback);
		}
	});
};

db.prototype.getUser = function(info, callback) {
	if (info.hasOwnProperty('username'))
		util.dispatch(callback, info);
	var finish = function(id) {
		if (typeof id === 'number') {
			getUserFromId(id, callback);
		} else {
			util.dispatch(callback);
		}
	}.bind(this);
	var parsed = parseInt(info);
	if (isNaN(parsed)) {
		getUserIdFromName(info, finish);
	} else {
		finish(parsed);
	}
};

db.prototype.login = function(user, password, callback) {
	this.getUser(user, function(user) {
		if (user) {
			bcrypt.compare(password, user.password, function(err, res) {
				if (res === true) {
					util.dispatch(callback, user);
				} else {
					util.dispatch(callback);
				}
			});
		} else {
			util.dispatch(callback);
		}
	});
};

var parseInteraction = function(interaction) {
	var parts = interaction.split('/');
	var ret = {
		attempted: null,
		solved: null,
		attempts: 0
	};
	for (var i=0;i<parts.length && i < 3;++i) {
		var parsed = parseInt(parts[i]);
		if (isNaN(parsed)){
			break;
		} else if (parsed <= 0) {
			continue
		} else if (i === 0) {
			ret.attempted = new Date(parsed);
		} else if (i === 1) {
			ret.solved = new Date(parsed);
		} else if (i === 2) {
			ret.attempts = parsed;
		}
	}
	return ret;
};

db.prototype.getInteraction = function(userid, problemid, callback) {
	rdb.hget('user:problems:' + userid, problemid, function(err, res) {
		if (res) {
			util.dispatch(callback, parseInteraction(res));
		} else {
			util.dispatch(callback);
		}
	});
};

db.prototype.getInteractions = function(userid, callback) {
	rdb.hgetall('user:problems:' + userid, function(err, res) {
		if (res) {
			for (var key in res) {
				if (res.hasOwnProperty(key)) {
					res[key] = parseInteraction(res[key]);
				}
			}
			util.dispatch(callback, res);
		} else {
			util.dispatch(callback);
		}
	});
};

module.exports = new db();