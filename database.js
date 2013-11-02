var util = require('./util');
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
	id: 1,
	points: 100,
	author: 'Strikeskids',
	statement: 'My test problem!!!',
	answer: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
};
var testUser = {
	username: 'Strikeskids',
	password: '$2a$12$EECy0Vupy86vhAfCJ4ei/eDTukWoSFoAnL1zp5B8iYd2O/3R98zs.',
	email: "csc@strikeskids.com",
	date: 1382910172012,
	id: 1
};

var problems = {
	'0': testProblem
};

db.prototype.checkProblem = function(userid, problemid, answer, callback) {
	this.getProblem(problemid, function(problem) {
		if (!problem) callback();
		var correct = shasum(answer) === problem.answer;
		if (userid && correct) {
			this.addInteraction(userid, problemid, correct);
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
		} else {
			util.dispatch(callback);
		}
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
	if (info.hasOwnProperty('username')) {
		util.dispatch(callback, info);
		return;
	}
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

db.prototype.addUser = function(data, callback) {
	var fails = {};
	if (!data.username || data.username.length < 5) {
		fails.user = true;
	}
	if (!data.password || data.password.length < 5) {
		fails.password = true;
	}
	if (data.password !== data.repassword) {
		fails.repassword = true;
	}
	if (shasum('captcha' + data.captcha) !== data.captchaans) {
		fails.captcha = true;
	}
	if (!data.email || data.email.length < 5 || data.email.indexOf('@') < 0) {
		fails.email = true;
	}
	if (Object.keys(fails).length > 0) {
		util.dispatch(callback, fails);
		return;
	}
	getUserIdFromName(data.username, function(id) {
		if (typeof id === 'number') {
			fails.user = true;
			util.dispatch(callback, fails);
			return;
		} else {
			var user = {
				username: data.username,
				email: data.email,
				date: Date.now()
			};
			var calls = 0, callsNeeded = 2;
			var finishCreation = function() {
				if (++calls >= callsNeeded) {
					var multi = rdb.multi();
					multi.hset('users', user.username, user.id);
					multi.hmset('user:'+user.id, user);
					multi.exec(function(err, res) {
						if (!err) {
							util.dispatch(callback, true);
						} else {
							util.dispatch(callback, false);
						}
					});
				}
			};
			rdb.incr('user:id:next', function(err, res) {
				if (typeof res === 'number') {
					user.id = res;
					finishCreation();
				} else {
					util.dispatch(callback, false);
				}
			});
			console.log("Hashing",data.password);
			bcrypt.hash(data.password, 12, function(err, hash) {
				if (hash) {
					user.password = hash;
					finishCreation();
				} else {
					util.dispatch(callback, false);
				}
			});
		}
	});
};

var parseInteraction = function(interaction) {
	var parts = interaction ? interaction.split(':') : [];
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

var deparseInteraction = function(interaction) {
	var ret = [];
	ret.push(interaction.attempted ? interaction.attempted.getTime() : '');
	ret.push(interaction.solved ? interaction.solved.getTime() : '');
	ret.push(interaction.attempts);
	return ret.join(':');
};

db.prototype.addInteraction = function(userid, problemid, correct) {
	this.getInteraction(userid, problemid, function(interaction) {
		var now = new Date();
		if (!interaction.attempted){
			interaction.attempted = now;
		}
		if (!interaction.solved) {
			interaction.attempts++;
			if (correct) {
				interaction.solved = now;
			}
		}
		rdb.hset('user:'+userid+':problems', problemid, deparseInteraction(interaction));
	}.bind(this));
};

db.prototype.getInteraction = function(userid, problemid, callback) {
	rdb.hget('user:'+userid+':problems', problemid, function(err, res) {
		util.dispatch(callback, parseInteraction(res));
	});
};

db.prototype.getInteractions = function(userid, callback) {
	rdb.hgetall('user:'+userid+':problems', function(err, res) {
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