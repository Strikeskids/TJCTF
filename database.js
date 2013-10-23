var util = require('util');
var redis = require('redis');
var crypto = require('crypto');
var bcrypt = require('bcrypt');

var shasum = function(input) {
	return crypto.createHash('sha1').update(input).digest('hex');
};

var db = function() {
};

var rdb;

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
	username: 'Strikeskids'
};

var problems = {
	'0': testProblem
};

db.prototype.init = function() {
	
};

db.prototype.checkProblem = function(problemid, answer) {
	problem = this.getProblem(problemid);
	if (!problem) {
		return {};
	}
	correct = shasum(answer) === problem.answer;
	if (correct) {
		//do user-related stuff
	}
	return {
		problem: problem,
		correct: correct
	};
};

db.prototype.getProblem = function(problemid) {
	return testProblem;
};

db.prototype.getProblems = function() {
	return problems;
};

db.prototype.getUser = function(uid) {
	return testUser;
};

db.prototype.getUserId = function(username) {

};

db.prototype.getUserFromName = function(username) {
	var id = this.getUserId(username);
	if (typeof id === 'number') {
		return getUser(id);
	}
	return null;
};

db.prototype.login = function(username, password, callback) {
	var user = this.getUserFromName(username);
	if (user) {
		callback = function() { callback(user.id);  };
		
	} else {
		callback();
	}
};

db.prototype.getInteraction = function(userid, problemid) {

};

module.exports = new db();