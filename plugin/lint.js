(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("tern/lib/infer"), require("tern/lib/tern"), require("acorn/util/walk"));
  if (typeof define == "function" && define.amd) // AMD
    return define(["tern/lib/infer", "tern/lib/tern", "acorn/util/walk"], mod);
  mod(tern, tern, acorn.walk);
})(function(infer, tern, walk) {
  "use strict";
  
  function outputPos(query, file, pos) {
    if (query.lineCharPositions) {
      var out = file.asLineChar(pos);
      return out;
    } else {
      return pos;
    }
  }

  function makeVisitors(query, file, messages) {
	
	function addMessage(node, msg, severity) {
      var error = makeError(node, msg, severity);
      messages.push(error);		
	}
	
    function makeError(node, msg, severity) {
      var pos = getPosition(node);
      return {
          message: msg,
          from: outputPos(query, file, pos.start),
          to: outputPos(query, file, pos.end),
          severity : severity
      };
    }

    function getName(node) {
      if(node.callee) {
        // This is a CallExpression node.
        // We get the position of the function name.
        return getName(node.callee);
      } else if(node.property) {
        // This is a MemberExpression node.
        // We get the name of the property.
        return node.property.name;
      } else {
        return node.name;
      }
    }

    function getPosition(node) {
      if(node.callee) {
        // This is a CallExpression node.
        // We get the position of the function name.
        return getPosition(node.callee);
      }
      if(node.property) {
        // This is a MemberExpression node.
        // We get the position of the property.
        return node.property;
      }
      return node;
    }

    // Check if a parent type defines a property.
    function isPropertyDefined(parentType, propertyName) {
      if(typeof parentType.hasProp == 'function' && parentType.hasProp(propertyName, true)) {
        return true;
      } else if(parentType.proto && typeof parentType.proto.hasProp == 'function' &&
            parentType.proto.hasProp(propertyName, true)) {
        // This is the case for Prim
        return true;
      }

      var propertyDefined = false;
      if(parentType.types) {
        // AVal

        // We cannot use parentType.getProp or parentType.props - in the case of an AVal,
        // this may contain properties that are not really defined.
        parentType.types.forEach(function(potentialType) {
          // Obj#hasProp checks the prototype as well
          if(isPropertyDefined(potentialType, propertyName)) {
            propertyDefined = true;
          }
        });
      }
      return propertyDefined;
    }

    function isPropertyDefinedOnFunction(parentType, propertyName) {
      if(typeof parentType.retval != 'undefined') {
        // Fn
        if(isPropertyDefined(parentType.retval, propertyName)) {
          return parentType;
        }
      }

      if(parentType.types) {
        // AVal
        var result = null;
        parentType.types.forEach(function(potentialType) {
          var fn = isPropertyDefinedOnFunction(potentialType, propertyName);
          if(fn != null) {
            result = fn;
          }
        });
        return result;
      }

      return null;
    }

    var visitors = {
      // Detects expressions of the form `object.property`
      MemberExpression: function(node, state, c) {
        var rule = getRule("UnknownProperty");
        if (!rule) return;
        var type = infer.expressionType({node: node, state: state});
        var parentType = infer.expressionType({node: node.object, state: state});

        if(node.computed) {
          // Bracket notation.
          // Until we figure out how to handle these properly, we ignore these nodes.
          return;
        }

        if(!parentType.isEmpty() && type.isEmpty()) {
          // The type of the property cannot be determined, which means
          // that the property probably doesn't exist.

          // We only do this check if the parent type is known,
          // otherwise we will generate errors for an entire chain of unknown
          // properties.

          // Also, the expression may be valid even if the parent type is unknown,
          // since the inference engine cannot detect the type in all cases.

          // In some cases the type is unknown, even if the property is defined
          var propertyDefined = isPropertyDefined(parentType, node.property.name);

          if(!propertyDefined) {
            var suggestion = null;
            var fn = isPropertyDefinedOnFunction(parentType, node.property.name);
            if(fn) {
              suggestion = "Did you mean '" + getName(node.object) + "()." + getName(node) + "'?";
            }

            var message = "Unknown property '" + getName(node) + "'";
            if(suggestion) {
              message += ". " + suggestion;
            }
            addMessage(node, message, rule.severity);
          }
        }
      },
      // Detects top-level identifiers, e.g. the object in
      // `object.property` or just `object`.
      Identifier: function(node, state, c) {
        var rule = getRule("UnknownIdentifier");
        if (!rule) return;
        var type = infer.expressionType({node: node, state: state});

        if(type.originNode != null) {
          // The node is defined somewhere (could be this node),
          // regardless of whether or not the type is known.
        } else if(type.isEmpty()) {
          // The type of the identifier cannot be determined,
          // and the origin is unknown.
          addMessage(node, "Unknown identifier '" + getName(node) + "'", rule.severity);        	
        } else {
          // Even though the origin node is unknown, the type is known.
          // This is typically the case for built-in identifiers (e.g. window or document).
        }
      },
      // Detects function calls.
      // `node.callee` is the expression (Identifier or MemberExpression)
      // the is called as a function.
      CallExpression: function(node, state, c) {
        var rule = getRule("NotAFunction");
        if (!rule) return;    	  
        var type = infer.expressionType({node: node.callee, state: state});
        if(!type.isEmpty()) {
          // If type.isEmpty(), it is handled by MemberExpression/Identifier already.

          // An expression can have multiple possible (guessed) types.
          // If one of them is a function, type.getFunctionType() will return it.
          var fnType = type.getFunctionType();
          if(fnType == null) {
            var parentType = infer.expressionType({node: node.callee.object, state: state});
            if(parentType == null || parentType.isEmpty()) {
              // Parent type is empty. This means that this type is a guess at best. To prevent false
              // warnings, we ignore this case.
            } else {
              addMessage(node, "'" + getName(node) + "' is not a function", rule.severity);
            }
          } else if (fnType.lint) {
        	// custom lint for function
        	fnType.lint(node, addMessage);
          }
        }
      }
    };

    return visitors;
  }

  // Adapted from infer.searchVisitor.
  // Record the scope and pass it through in the state.
  // VariableDeclaration in infer.searchVisitor breaks things for us.
  var scopeVisitor = walk.make({
    Function: function(node, _st, c) {
      var scope = node.body.scope;
      if (node.id) c(node.id, scope);
      for (var i = 0; i < node.params.length; ++i)
        c(node.params[i], scope);
      c(node.body, scope, "ScopeBody");
    }
  });

  // Other alternative bases:
  //   walk.base (no scope handling)
  //   infer.searchVisitor
  //   infer.fullVisitor
  var base = scopeVisitor;
  
  tern.defineQueryType("lint", {
    takesFile: true,
    run: function(server, query, file) {
      try {
        var messages = [], ast = file.ast, state = file.scope;
        var visitors = makeVisitors(query, file, messages);
        walk.simple(ast, visitors, base, state);
        return {messages: messages};
      } catch(err) {
        console.error(err.stack);
        return {messages: []};
      }
    }
  });

  var lints = Object.create(null);
  tern.registerLint = function(defName, path, prop, lint) { 
	var lintsForDef = lints[defName];
	if (!lintsForDef) {lintsForDef = []; lints[defName] = lintsForDef;} 
	lintsForDef.push({path: path, prop: prop, lint: lint});
  };
  
  var defaultRules = {
    "UnknownProperty" : {"severity" : "warning"},
    "UnknownIdentifier" : {"severity" : "warning"},
    "NotAFunction" : {"severity" : "error"}
  }
  
  tern.registerPlugin("lint", function(server, options) {	
    server._lint = {
      rules: getRules(options)	
    };
    return {
    	passes: {postLoadDef: postLoadDef}
    };
  });
  
  function getRules(options) {
    var rules = {};
    for(var ruleName in defaultRules) {
      if (options && options.rules && options.rules[ruleName] && options.rules[ruleName].severity) {
    	rules[ruleName] =  options.rules[ruleName];
      }	else {
      	rules[ruleName] = defaultRules[ruleName];
      }
    }
    return rules;
  }
  
  function getRule(ruleName) {
    var cx = infer.cx(), server = cx.parent, rules = server._lint.rules;
    return rules[ruleName];
  }
  
  function postLoadDef(json) {
    var cx = infer.cx(), defName = json["!name"], lintsForDef = lints[defName];
    if (cx.paths && lintsForDef) {
      for (var i = 0; i < lintsForDef.length; i++) {
        var dataLint = lintsForDef[i];
        var proto = cx.paths[dataLint.path], type = null;
        if (proto) {
          type = proto.getProp(dataLint.prop).getType();
        } else {
          var o = cx.props[dataLint.path];
          if (o) {
            type = o[0].props[dataLint.prop].getType();
          }
        } 
        if (type) type.lint = dataLint.lint;				
	  }          
    }
  }
  
  // Hack to manage lint for node, requirejs which are hosted in tern github
  tern.registerLint("node", "require", "require", function(node, addMessage) {
	  var cx = infer.cx(), server = cx.parent, data = server._node;
	  var argNodes = node.arguments;
	  if (argNodes && argNodes.length && argNodes[0].type == "Literal" || typeof argNodes[0].value == "string") {
	    var name = argNodes[0].value, module = cx.definitions.node[name];
	    if (!module) {
      	  addMessage(argNodes[0], "Unknown module '" + name + "'", 'warning');
        }
	  }
  });
  
});  