const assert = require('node:assert/strict')
const fs = require('node:fs')

const viewRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/view/route.ts', 'utf8')
const downloadRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/download/route.ts', 'utf8')
const printRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/print/route.ts', 'utf8')
const fileRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/file/route.ts', 'utf8')

assert.match(viewRoute, /Rota desativada/)
assert.match(downloadRoute, /Rota desativada/)
assert.match(printRoute, /Rota desativada/)
assert.match(fileRoute, /buildControlledPdf/)
assert.doesNotMatch(fileRoute, /word original/i)

console.log('document-final-pdf-enforcement ok')