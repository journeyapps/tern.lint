var util = require("./util");

exports['test Known property'] = function() {
	// Known property document.getElementById
	util.assertLint("var elt = document.getElementById('myId');", {
		messages : []
	}, [ "browser" ]);
}

exports['test Unknown property'] = function() {
	// Unknown property
	util.assertLint("var elt = document.getElementByIdXXX('myId');", {
		messages : [ {
			"message" : "Unknown property 'getElementByIdXXX'",
			"from" : 19,
			"to" : 36,
			"severity" : "warning"
		} ]
	}, [ "browser" ]);
	// Unknown property as error
	var options = {"rules" : {"UnknownProperty" : {"severity" : "error"}}};
	util.assertLint("var elt = document.getElementByIdXXX('myId');", {
		messages : [ {
			"message" : "Unknown property 'getElementByIdXXX'",
			"from" : 19,
			"to" : 36,
			"severity" : "error"
		} ]
	}, [ "browser" ], options);	
}

exports['test Unknown identifier'] = function() {
	// without 'browser' def, document is not known
	// The check does not continue to getElementById, since
	// the real cause is that document is undefined.
	util.assertLint("var elt = document.getElementById('myId');", {
		messages : [ {
			"message" : "Unknown identifier 'document'",
			"from" : 10,
			"to" : 18,
			"severity" : "warning"
		} ]
	});
	// Unknown identifier as error
	var options = {"rules" : {"UnknownIdentifier" : {"severity" : "error"}}};
	util.assertLint("var elt = document.getElementById('myId');", {
		messages : [ {
			"message" : "Unknown identifier 'document'",
			"from" : 10,
			"to" : 18,
			"severity" : "error"
		} ]
	}, null, options);	
}

exports['test issue1'] = function() {
	// Known property for this. See issue
	// https://github.com/angelozerr/tern.lint/issues/1
	util.assertLint("var a = [];\nvar len = a.length();", {
		messages : [ {
			"message" : "'length' is not a function",
			"from" : 24,
			"to" : 30,
			"severity" : "error"
		} ]
	}, [ "ecma5" ]);
	// Not a function as warning
	var options = {"rules" : {"NotAFunction" : {"severity" : "warning"}}};
	util.assertLint("var a = [];\nvar len = a.length();", {
		messages : [ {
			"message" : "'length' is not a function",
			"from" : 24,
			"to" : 30,
			"severity" : "warning"
		} ]
	}, [ "ecma5" ], options);	
	// without ecma5, var 'a' is not an array.
	util.assertLint("var a = [];\nvar len = a.length();", {
		messages : [ {
			"message" : "Unknown property 'length'",
			"from" : 24,
			"to" : 30,
			"severity" : "warning"
		} ]
	});
}

exports['test issue2'] = function() {
	// Known property for this. See issue
	// https://github.com/angelozerr/tern.lint/issues/2
	util
			.assertLint(
					"function CTor() { this.size = 10; }\nCTor.prototype.hallo = 'hallo';",
					{
						messages : []
					});
}

exports['test variables inside functions'] = function() {
	util.assertLint("function test() { var a = {len: 5}; var len = a.len; }\nfunction b() { }", {
		messages : [ ]
	});

	util.assertLint("function b() { }\nfunction test() { var d = 5; var a = {len: 5}; var len = a.len; }", {
		messages : [ ]
	});
}


exports['test functions parameters'] = function() {
	// In this case the type of `a` is inferred as a string
	util.assertLint("function test(a) { var t = a; }; test('something');", {
		messages : [ ]
	});

	// In this case the type is unknown, but the variable is defined
	// (should not produce a warning)
	util.assertLint("function test(a) { var t = a; };", {
		messages : [ ]
	});
}


exports['test properties on functions parameters'] = function() {
    // In this case the type of `a` is inferred as an object with a property `len`.
    util.assertLint("function test(a) { var len = a.len; }; test({len: 5});", {
        messages : [ ]
    });

    // In this case the type of `a` is unknown, and should not produce warnings
    // on any of its properties.
    util.assertLint("function test(a) { var len = a.len; };", {
        messages : [ ]
    });

    // The same goes for function calls on an unknown type
    util.assertLint("function test(a) { var len = a.myLength(); };", {
        messages : [ ]
    });

    // a is an unkown type, but a.PI is guessed to be a number.
    // It could also be a function on another object, so should not produce a warning.
    util.assertLint("var Math = {PI: 3.14}; function test(a) { a.PI(); a.foo()};", {
        messages : [ ]
    });

    // a is guessed to be of type Math. Same as above.
    util.assertLint("var Math = {PI: 3.14}; function test(a) { a.PI(); };", {
        messages : [ ]
    });

    // a is known to be of type Math. In this case it should produce an error.
    util.assertLint("var Math = {PI: 3.14}; function test(a) { a.PI(); }; test(Math);", {
        "messages": [ {
            "message": "'PI' is not a function",
            "from": 44,
            "to": 46,
            "severity": "error"} ]
    });

    // a is guessed to be a function or number. No warning.
    util.assertLint("var Math = {PI: 3.14}; var other = {PI: function() {}}; function test(a) { a.PI(); }; test(Math); test(other)", {
        messages : [ ]
    });
}

exports['test assignment of unknown value'] = function() {

	util.assertLint("var a = {}; function test(p) { var b = a.b; };", {
		messages : [ {
			"message": "Unknown property 'b'",
			"from": 41,
			"to": 42,
			"severity": "warning"} ]
	});

	// The type of a.t is unknown, but it is still a valid property.
	util.assertLint("var a = {}; function test(p) { a.t = p; var b = a.t; }", {
		messages : [ ]
	});

	util.assertLint("var a = {}; function test(p) { a.t = p; }", {
		messages : [ ]
	});

	// This should only contain a warning for `notdefined`, not for b = a.val.
	util.assertLint("function A() {}; A.prototype.val = notdefined; var a = new A(); var b = a.val;", {
		messages : [ {
			"message": "Unknown identifier 'notdefined'",
			"from": 35,
			"to": 45,
			"severity": "warning"} ]
	});

	util.assertLint("var a = {t: 5}; function test(p) { a.t = p; }", {
		messages : [ ]
	});
}

exports['test dynamic properties (bracket notation)'] = function() {
	util.assertLint("var obj = { test: 1 }; var key = 'test'; var val1 = obj[key]; var val2 = obj['test'];", {
		messages : [ ]
	});

	util.assertLint("var obj = { test: function() {} }; var key = 'test'; obj[key](); obj['test']();", {
		messages : [ ]
	});
}

exports['test function properties'] = function() {
	util.assertLint("function a() { return {b: 1}; }; var obj = a.b;", {
		messages : [ {
			"message": "Unknown property 'b'. Did you mean 'a().b'?",
			"from": 45,
			"to": 46,
			"severity": "warning"} ]
	});

	util.assertLint("function a() { return {b: 1}; }; var c = {k: a}; var obj = c.k.b;", {
		messages : [ {
			"message": "Unknown property 'b'. Did you mean 'k().b'?",
			"from": 63,
			"to": 64,
			"severity": "warning"} ]
	});

	util.assertLint("Date.now.toFixed();", {
		messages : [ {
			"message": "Unknown property 'toFixed'. Did you mean 'now().toFixed'?",
			"from": 9,
			"to": 16,
			"severity": "warning"} ]
	}, [ "ecma5" ]);
}



if (module == require.main)
	require('test').run(exports)