const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/documents/versions/[versionId]/download/route.ts', 'utf8')
assert.match(route, /requiresTerm: true/)
assert.match(route, /documentTermAcceptance\.findUnique/)

console.log('document-download-term-enforcement ok')