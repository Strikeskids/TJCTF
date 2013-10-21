var util = require('util');
var redis = require('redis');
var crypto = require('crypto');

var shasum = function(input) {
	return crypto.createHash('sha1').update(input).digest('hex');
};

var exp = {};

var db;

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

exp.init = function() {
	
};

exp.checkProblem = function(problemid, answer) {
	problem = getProblem(problemid);
	if (!problem) {
		return false;
	}
};

exp.getProblem = function(problemid) {
	return testProblem;
};

exp.getProblems = function() {
	return problems;
};

exp.getUser = function(uid) {
	return testUser;
};

exp.getInteraction = function(userid, problemid) {

};

module.exports = exp;