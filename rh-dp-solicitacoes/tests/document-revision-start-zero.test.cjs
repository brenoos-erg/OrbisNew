const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/documents/route.ts', 'utf8')
assert.match(route, /revisionNumber:\s*payload\.revisionNumber \?\? 0/)

console.log('document-revision-start-zero ok')