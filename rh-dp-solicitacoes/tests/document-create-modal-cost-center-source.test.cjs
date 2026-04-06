const assert = require('node:assert/strict')
const fs = require('node:fs')

const documentsGrid = fs.readFileSync('src/components/documents/DocumentsGrid.tsx', 'utf8')
const costCenterSelect = fs.readFileSync('src/components/solicitacoes/CostCenterSelect.tsx', 'utf8')
const costCentersDataSource = fs.readFileSync('src/lib/costCentersDataSource.ts', 'utf8')

assert.match(documentsGrid, /fetchOfficialCostCenters<CostCenterOption>\(\)/)
assert.match(documentsGrid, /Centros de custo carregados para modal de cadastro/)
assert.match(documentsGrid, /Tentativa de chamada para \/api\/departments detectada/)
assert.doesNotMatch(documentsGrid, /fetch\(['"`]\/api\/departments['"`]/)

assert.match(costCenterSelect, /return \[code, description\]\.filter\(Boolean\)\.join\(' - '\)/)
assert.doesNotMatch(costCentersDataSource, /\/api\/departments/)
assert.match(costCentersDataSource, /\/api\/cost-centers\/select/)
assert.match(costCentersDataSource, /\/api\/cost-centers\?pageSize=/)

console.log('document-create-modal-cost-center-source ok')