const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../')

module.exports = {
  read: async function (filepath) {
    return fs.readFileSync(path.join(root, filepath), { encoding: 'utf-8' })
  },
}
