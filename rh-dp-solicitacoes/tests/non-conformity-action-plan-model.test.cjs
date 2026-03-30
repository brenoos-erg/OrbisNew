const assert = require('node:assert/strict')
const fs = require('node:fs')

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
assert.doesNotMatch(schema, /planoAcaoCodigo\s+String\?/)
assert.doesNotMatch(schema, /planoAcaoObjetivo\s+String\?/)
assert.doesNotMatch(schema, /planoAcaoEvidencias\s+String\?/)

const detail = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/[id]/NaoConformidadeDetailClient.tsx', 'utf8')
assert.match(detail, /Plano de ação vinculado à não conformidade/)
assert.match(detail, /Ações vinculadas:/)
assert.doesNotMatch(detail, /Entidade principal do plano/)
assert.doesNotMatch(detail, /Objetivo do plano/)
assert.doesNotMatch(detail, /Evidências das tratativas/)

console.log('non-conformity-action-plan-model ok')