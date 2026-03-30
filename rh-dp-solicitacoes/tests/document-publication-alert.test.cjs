const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/documents/versions/[versionId]/approve/route.ts', 'utf8')
assert.match(route, /notifyDocumentPublished/) 
assert.match(route, /Document publication alert not sent/)

console.log('document-publication-alert ok')