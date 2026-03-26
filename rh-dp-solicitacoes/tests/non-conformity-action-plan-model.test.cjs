const assert = require('node:assert/strict')
const fs = require('node:fs')

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
assert.match(schema, /planoAcaoCodigo\s+String\?/)
assert.match(schema, /planoAcaoObjetivo\s+String\?/)
assert.match(schema, /planoAcaoEvidencias\s+String\?/)

const detail = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/[id]/NaoConformidadeDetailClient.tsx', 'utf8')
assert.match(detail, /Entidade principal do plano/)
assert.match(detail, /Objetivo do plano/)
assert.match(detail, /Evidências das tratativas/)

console.log('non-conformity-action-plan-model ok')