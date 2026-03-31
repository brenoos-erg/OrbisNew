const assert = require('node:assert/strict')
const fs = require('node:fs')

const grid = fs.readFileSync('src/components/documents/DocumentsGrid.tsx', 'utf8')
const cancelRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/cancel/route.ts', 'utf8')
const deleteRoute = fs.readFileSync('src/app/api/documents/[id]/route.ts', 'utf8')

assert.match(grid, /canManageDocuments/)
assert.match(grid, /\/api\/documents\/management-access/)
assert.match(grid, /Confirmar cancelamento/)
assert.match(grid, /Confirmar exclusão/)
assert.match(grid, /Cancelar documento/)
assert.match(grid, /Excluir documento/)

assert.match(cancelRoute, /withModuleLevel\(/)
assert.match(cancelRoute, /ModuleLevel\.NIVEL_3/)
assert.match(cancelRoute, /DocumentVersionStatus\.CANCELADO/)
assert.match(cancelRoute, /status: 409/)

assert.match(deleteRoute, /withModuleLevel\(/)
assert.match(deleteRoute, /ModuleLevel\.NIVEL_3/)
assert.match(deleteRoute, /isoDocument\.delete/)

console.log('document-management-level3 ok')