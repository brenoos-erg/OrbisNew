const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoRouteSource = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')

// GET precisa priorizar o approverId canônico para evitar reidratar avaliador antigo.
assert.match(fluxoRouteSource, /const canonicalApproverId = normalizeStringValue\(solicitation\.approverId\)/)
assert.match(fluxoRouteSource, /const resolvedEvaluatorId = canonicalApproverId \|\| resolveExperienceEvaluatorId\(payloadCampos, experienceEvaluators\)/)
assert.match(fluxoRouteSource, /solicitation\.approver\?\.fullName/)

// PATCH precisa resolver o avaliador a partir do payload recebido no form (nome/id novos) antes de fallback no merged.
assert.match(fluxoRouteSource, /const incomingEvaluatorId = resolveExperienceEvaluatorId\(incomingCampos, experienceEvaluators\)/)
assert.match(
  fluxoRouteSource,
  /const hasIncomingEvaluatorValue =\s*\n\s*Object\.prototype\.hasOwnProperty\.call\(incomingCampos, 'gestorImediatoAvaliadorId'\) \|\|\s*\n\s*Object\.prototype\.hasOwnProperty\.call\(incomingCampos, 'gestorImediatoAvaliador'\)/,
)
assert.match(
  fluxoRouteSource,
  /const evaluatorId = hasIncomingEvaluatorValue\s*\n\s*\? incomingEvaluatorId \|\| resolveExperienceEvaluatorId\(mergedCampos, experienceEvaluators\)\s*\n\s*: previousEvaluatorId/,
)

// Payload canônico deve acompanhar o approverId final persistido.
assert.match(fluxoRouteSource, /const persistedApproverId = resolvedApproverId !== undefined \? resolvedApproverId : solicitation\.approverId/)
assert.match(fluxoRouteSource, /persistedApproverId === null\s*\? null/)
assert.match(fluxoRouteSource, /persistedApproverId\s*\?\s*experienceEvaluators\.find\(\(item\) => item\.id === persistedApproverId\) \?\? \{\s*\n\s*id: persistedApproverId,\s*\n\s*\}/)

// Fluxo de avaliação deve limpar responsável assumido para não reaplicar o antigo.
assert.match(fluxoRouteSource, /if \(isExperienceEvaluation\) \{\s*\n\s*resolvedResponsibleId = null\s*\n\s*\}/)

console.log('✅ experience-evaluation-flow-persistence-regression.test passed')
