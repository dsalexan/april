const debug = require('debug')('april')

function inject(debugObject) {
  debugObject.get = (name) => {
    if (debugObject.__index__ === undefined) debugObject.__index__ = {}
    let obj = debugObject.__index__[name]

    if (obj === undefined) {
      const newDebug = extend(debugObject, name)
      debugObject.__index__[name] = newDebug
      obj = newDebug
    }

    return obj
  }
}

function extend(debugParent, name) {
  const obj = debugParent.extend(name)
  inject(obj)
  return obj
}

inject(debug)
module.exports = debug

module.exports.publisher = extend(debug, 'publisher')
