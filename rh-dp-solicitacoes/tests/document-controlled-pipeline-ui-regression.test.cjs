const assert = require('node:assert/strict')
const fs = require('node:fs')

const documentsGrid = fs.readFileSync('src/components/documents/DocumentsGrid.tsx', 'utf8')
const visualizacaoClient = fs.readFileSync('src/app/dashboard/controle-documentos/visualizacao/[versionId]/visualizacao-documento-client.tsx', 'utf8')

assert.doesNotMatch(documentsGrid, /window\.open\(/)
assert.doesNotMatch(visualizacaoClient, /contentWindow\?\.print\(/)
assert.match(visualizacaoClient, /window\.location\.replace\(/)

console.log('document-controlled-pipeline-ui-regression ok')