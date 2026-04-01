const assert = require('node:assert/strict')
const fs = require('node:fs')

const viewRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/view/route.ts', 'utf8')
const printRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/print/route.ts', 'utf8')
const fileRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/file/route.ts', 'utf8')

assert.match(viewRoute, /não suportado para visualização final em PDF/)
assert.match(printRoute, /não suportado para impressão final em PDF/)
assert.match(fileRoute, /Não foi possível aplicar a marca d'água obrigatória no documento/)
assert.doesNotMatch(fileRoute, /word original/i)

console.log('document-final-pdf-enforcement ok')