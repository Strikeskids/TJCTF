var express = require('express');
var db = require('./database');

module.exports = function(app) {
	app.get('/problems', function(req, res) {
		
	});

	app.get('/problems/:problemid', function(req, res) {
		res.render('problem.jade', {
			problem: db.getProblem(req.params.problemid)
		});
	});
};