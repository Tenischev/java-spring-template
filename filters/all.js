const filter = module.exports;
const _ = require('lodash');
const ScsLib = require('../lib/scsLib.js');
const scsLib = new ScsLib();

function identifierName(str) {
  return scsLib.getIdentifierName(str);
}
filter.identifierName = identifierName;

function indent(numTabs) {
  return "\t".repeat(numTabs);
}

function indent1(numTabs) {
  return indent(numTabs);
}
filter.indent1 = indent1;

function indent2(numTabs) {
  return indent(numTabs + 1);
}
filter.indent2 = indent2;

function indent3(numTabs) {
  return indent(numTabs + 2);
}
filter.indent3 = indent3;

// This returns the list of methods belonging to an object, just to help debugging.
const getMethods = (obj) => {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)))
  return [...properties.keys()].filter(item => typeof obj[item] === 'function')
}

function schemaExtraIncludes([schemaName, schema]) {
  console.log("checkPropertyNames " + schemaName + "  " + schema.type());
  let ret = {};
  if(checkPropertyNames(schemaName, schema)) {
    ret.needJsonPropertyInclude = true;
  }
  console.log("checkPropertyNames:");
  console.log(ret);
  return ret;
}
filter.schemaExtraIncludes = schemaExtraIncludes;

// Returns true if any property names will be different between json and java.
function checkPropertyNames(name, schema) {
  let ret = false;

  console.log(JSON.stringify(schema));
  console.log('checkPropertyNames: checking schema ' + name + getMethods(schema));

  var properties = schema.properties();


  if (schema.type() === 'array') {
    properties = schema.items().properties();
  }

  console.log("schema type: " + schema.type());

  for (let propName in properties) {
    let javaName = _.camelCase(propName);
    let prop = properties[propName];
    console.log('checking ' + propName + ' ' + prop.type());

    if (javaName !== propName) {
      console.log("Java name " + javaName + " is different from " + propName);
      return true;
    }
    if (prop.type() === 'object') {
      console.log("Recursing into object");
      let check = checkPropertyNames(propName, prop);
      if (check) {
        return true;
      }
    } else if (prop.type() === 'array') {
      console.log('checkPropertyNames: ' + JSON.stringify(prop));
      if (!prop.items) {
        throw new Error("Array named " + propName + " must have an 'items' property to indicate what type the array elements are.");
      }
      let itemsType = prop.items.type;
      console.log('checkPropertyNames: ' + JSON.stringify(prop.items));
      console.log('array of : ' + itemsType);
      if (itemsType === 'object') {
        console.log("Recursing into array");
        let check = checkPropertyNames(propName, prop.items);
        if (check) {
          return true;
        }
      }
    }
  }
  return ret;
}

// This maps json schema types to Java types.
const typeMap = new Map();
typeMap.set('boolean', 'Boolean');
typeMap.set('integer', 'Integer');
typeMap.set('null', 'String');
typeMap.set('number', 'Double');
typeMap.set('string', 'String');

// This returns the proper Java type for a schema property.
function fixType([name, javaName, property]) {

  //console.log('fixType: ' + name + " " + dump(property));

  let isArrayOfObjects = false;

  // For message headers, type is a property.
  // For schema properties, type is a function.
  let type = property.type;

  //console.log("fixType: " + property);

  if (typeof type == "function") {
    type = property.type();
  }

  // If a schema has a property that is a ref to another schema,
  // the type is undefined, and the title gives the title of the referenced schema.
  let ret;
  if (type === undefined) {
    if (property.enum()) {
      ret = _.upperFirst(javaName);
    } else {
      // check to see if it's a ref to another schema.
      ret = property.ext('x-parser-schema-id');

      if (!ret) {
        throw new Error("Can't determine the type of property " + name);
      }
    }
  } else if (type === 'array') {
    if (!property.items()) {
      throw new Error("Array named " + name + " must have an 'items' property to indicate what type the array elements are.");
    }
    let itemsType = property.items().type();

    if (itemsType) {

      if (itemsType === 'object') {
        isArrayOfObjects = true;
        itemsType = _.upperFirst(javaName);
      } else {
        itemsType = typeMap.get(itemsType);
      }
    }
    if (!itemsType) {
      itemsType = property.items().ext('x-parser-schema-id');

      if (!itemsType) {
        throw new Error("Array named " + name + ": can't determine the type of the items.");
      }
    }
    ret = _.upperFirst(itemsType) + "[]";
  } else if (type === 'object') {
    ret = _.upperFirst(javaName);
  } else {
    ret = typeMap.get(type);
    if (!ret) {
      ret = type;
    }
  }
  return [ret, isArrayOfObjects];
}
filter.fixType = fixType;

function toJavaType(str){
  switch(str) {
    case 'integer':
    case 'int32':
      return 'int';
    case 'long':
    case 'int64':
      return 'long';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'java.time.LocalDate';
    case 'dateTime':
    case 'date-time':
      return 'java.time.LocalDateTime';
    case 'string':
    case 'password':
    case 'byte':
      return 'String';
    case 'float':
      return 'float';
    case 'double':
      return 'double';
    case 'binary':
      return 'byte[]';
    default:
      return 'Object';
  }
}
filter.toJavaType = toJavaType;

function isProtocol(api, protocol){
  return JSON.stringify(api.json()).includes('"protocol":"' + protocol + '"');
};
filter.isProtocol = isProtocol;

function examplesToString(ex){
  let retStr = "";
  ex.forEach(example => {
    if (retStr !== "") {retStr += ", "}
    if (typeof example == "object") {
      try {
        retStr += JSON.stringify(example);
      } catch (ignore) {
        retStr += example;
      }
    } else {
      retStr += example;
    }
  });
  return retStr;
};
filter.examplesToString = examplesToString;

function splitByLines(str){
  if (str) {
    return str.split(/\r?\n|\r/).filter((s) => s !== "");
  } else {
    return "";
  }
};
filter.splitByLines = splitByLines;

function isRequired(name, list){
  return list && list.includes(name);
};
filter.isRequired = isRequired;

function schemeExists(collection, scheme){
  return _.some(collection, {'scheme': scheme});
};
filter.schemeExists = schemeExists;
