var util = require('util');

var exported = util._extend({}, util);

exported.check = function(object) {
	return (object && typeof object !== 'undefined');
};

exported.isFunction = function(object) {
	return (object && object.constructor && object.call && object.apply);
};

exported.dispatch = function(object) {
	if (exported.isFunction(object)) {
		object.apply(object, Array.prototype.slice.call(arguments, 1));
	}
};

exported.values = function(obj) {
	return Object.keys(obj).map(function(key) {
		return obj[key];
	});
};

module.exports = exported;