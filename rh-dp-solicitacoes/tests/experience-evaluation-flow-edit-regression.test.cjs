const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoSource = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')
const fluxoClientSource = fs.readFileSync(
  'src/app/dashboard/configuracoes/fluxo-solicitacao/FluxoSolicitacaoClient.tsx',
  'utf8',
)

assert.match(fluxoSource, /const ALWAYS_EDITABLE_FLOW_FIELDS = new Set\(\[/)
assert.match(fluxoSource, /'gestorImediatoAvaliadorId'/)
assert.match(fluxoSource, /Object\.prototype\.hasOwnProperty\.call\(incomingCampos, 'gestorImediatoAvaliadorId'\)/)
assert.match(fluxoSource, /const isExperienceEvaluation = solicitation\.tipoId === EXPERIENCE_EVALUATION_TIPO_ID/)
assert.match(fluxoSource, /resolvedApproverId = evaluatorId \|\| null/)
assert.match(fluxoSource, /resolvedResponsibleId = null/)
assert.match(fluxoSource, /let experienceEvaluatorChanged = false/)
assert.match(fluxoSource, /if \(experienceEvaluatorChanged\) continue/)
assert.match(fluxoClientSource, /function resolveExperienceEvaluatorName\(/)
assert.match(
  fluxoClientSource,
  /normalizedFields\.gestorImediatoAvaliador = evaluatorName \|\| evaluatorId/,
)
assert.match(
  fluxoClientSource,
  /gestorImediatoAvaliador: evaluatorName \|\| selectedId/,
)

console.log('✅ experience-evaluation-flow-edit-regression.test passed')
