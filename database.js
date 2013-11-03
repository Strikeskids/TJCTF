var util = require('./util');
var redis = require('redis');
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var marked = require('marked');

marked.setOptions({
	sanitize: true
});

var shasum = function(input) {
	return crypto.createHash('sha1').update(input).digest('hex');
};

var db = function() {
};

// var rdb;
var rdb = redis.createClient(null, null);

var problems = null;
var lastUpdate = 0;
var problemUpdateDelay = 5*60*1000;

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
	// console.log("Getting problem",problemid);
	this.getProblems(function(problems) {
		if (problemid in problems){
			util.dispatch(callback, problems[problemid]);
		} else {
			util.dispatch(callback);
		}
	});
};

db.prototype.getProblems = function(callback) {
	if (!problems || Date.now() - lastUpdate > problemUpdateDelay) {
		rdb.lrange('list:problem', 0, -1, function(err, ids) {
			// console.log(err, ids);
			if (err) {
				util.dispatch(callback, problems || {});
			}
			var tmpProblems = {};
			var multi = rdb.multi();
			for (var i=0;i<ids.length;++i) {
				multi.hgetall('problem:'+ids[i]);
			}
			multi.exec(function(err, replies) {
				// console.log(err, replies);
				if (err) {
					util.dispatch(callback, problems || {});
				}
				for (var i=0;i<ids.length;++i) {
					var prob = replies[i];
					prob.date = new Date(parseInt(prob.date));
					prob.points = parseInt(prob.points);
					prob.id = parseInt(prob.id);
					tmpProblems[ids[i]] = prob;
				}
				lastUpdate = Date.now();
				util.dispatch(callback, problems = tmpProblems);
			});
		});
	} else {
		util.dispatch(callback, problems);
	}
};

db.prototype.addProblem = function(data, callback) {
	var fails = {};
	if (!data.answer) fails.answer = true;
	if (!data.points) data.points = 0;
	if (isNaN(parseInt(data.points))) fails.points = true;
	if (!data.name) fails.name = true;
	if (!data.statement || data.statement.length < 10) fails.statement = true;
	if (Object.keys(fails).length > 0) {
		util.dispatch(callback, fails);
		return;
	}
	marked(data.statement, function(err, compiled) {
		if (err) {
			fails.statement = true;
			util.dispatch(callback, fails);
			return;
		}
		var prob = {
			answer: shasum(data.answer),
			statement: compiled,
			name: data.name,
			author: data.author,
			date: Date.now(),
			points: data.points
		};
		rdb.incr('problem:id:next', function(err, value) {
			if (err)
				util.dispatch(callback, false);
			prob.id = value;
			var multi = rdb.multi();
			multi.lpush('list:problem',prob.id);
			multi.hmset('problem:'+prob.id, prob);
			multi.exec(function(err) {
				util.dispatch(callback, err ? false : true);
			});
			lastUpdate = 0;
		});
	});
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
					multi.lpush('list:user', user.id);
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
				this.updateScore(userid, problemid);
			}
		}
		rdb.hset('user:'+userid+':problems', problemid, deparseInteraction(interaction));
	}.bind(this));
};

db.prototype.updateScore = function(userid, problemid) {
	this.getProblem(problemid, function(problem) {
		if (problem && problem.points > 0) {
			rdb.exists('user:'+userid+'submit', function(err, reply) {
				if (!reply) {
					var multi = rdb.multi();
					multi.setex('user:'+userid+'submit',5,userid);
					multi.zincrby('problem:scores',problem.points,userid);
					multi.exec();
				}
			});
		}
	});
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

db.prototype.getHighscores = function(callback) {
	rdb.zrevrange('problem:scores',0,-1,'withscores', function(err, scorelist) {
		var multi = rdb.multi();
		if (scorelist) {
			for (var i=0;i<scorelist.length;i+=2) {
				multi.hgetall('user:'+scorelist[i]);
			}
		}
		multi.exec(function(err, replies) {
			var ret = [];
			if (replies) {
				var currentRank = 0;
				var previousScore = -1;
				for (var i=0;i<replies.length;++i) {
					var user = replies[i];
					if (!user)
						continue;
					user.score = scorelist[i*2+1];
					if (previousScore !== user.score) {
						currentRank++;
						previousScore = user.score;
					}
					user.rank = currentRank;
					ret.push(user);
				}
			}
			util.dispatch(callback, ret);
		});
	});
};

module.exports = new db();