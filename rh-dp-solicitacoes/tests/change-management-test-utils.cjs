const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}
function seed() {
  return read('prisma/seed.ts');
}
function assertIncludesAll(source, values, context) {
  for (const value of values) {
    assert(source.includes(value), `${context} deve conter "${value}"`);
  }
}
module.exports = { read, seed, assertIncludesAll };
