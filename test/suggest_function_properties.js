var util = require("./util");

var IGNORE_UNUSED_VAR = {"rules" : {"UnusedVariable" : {"severity" : "none"}}};

exports['test function properties'] = function() {
	util.assertLint("function a() { return {b: 1}; }; var obj = a.b;", {
		messages : [ {
		"message": "Unknown property 'b'. Did you mean 'a().b'?",
			"from": 45,
			"to": 46,
			"severity": "warning",
		  "file": "test1.js"} ]
	}, [ "ecma5" ], null, IGNORE_UNUSED_VAR);

	util.assertLint("function a() { return {b: 1}; }; var c = {k: a}; var obj = c.k.b;", {
		messages : [ {
			"message": "Unknown property 'b'. Did you mean 'k().b'?",
			"from": 63,
			"to": 64,
			"severity": "warning",
		  "file": "test1.js"} ]
	}, [ "ecma5" ], null, IGNORE_UNUSED_VAR);

	util.assertLint("Date.now.toFixed();", {
		messages : [ {
			"message": "Unknown property 'toFixed'. Did you mean 'now().toFixed'?",
			"from": 9,
			"to": 16,
			"severity": "warning",
		  "file": "test1.js"} ]
	}, [ "ecma5" ], null, IGNORE_UNUSED_VAR);
}
