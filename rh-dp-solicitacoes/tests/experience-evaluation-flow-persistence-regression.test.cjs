const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoRouteSource = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')

// GET precisa priorizar o approverId canônico para evitar reidratar avaliador antigo.
assert.match(fluxoRouteSource, /const canonicalApproverId = normalizeStringValue\(solicitation\.approverId\)/)
assert.match(fluxoRouteSource, /const resolvedEvaluatorId = canonicalApproverId \|\| resolveExperienceEvaluatorId\(payloadCampos, experienceEvaluators\)/)
assert.match(fluxoRouteSource, /solicitation\.approver\?\.fullName/)

// PATCH precisa distinguir input explícito de avaliador para evitar reprocessamento indevido.
assert.match(fluxoRouteSource, /const evaluatorFieldKeys = \[/)
assert.match(fluxoRouteSource, /const hasExplicitEvaluatorInput = evaluatorFieldKeys\.some\(\(field\) => hasOwn\(incomingCampos, field\)\)/)
assert.match(fluxoRouteSource, /if \(isExperienceEvaluation && hasExplicitEvaluatorInput\) \{/)

// PATCH precisa resolver novo avaliador explicitamente e permitir limpeza explícita.
assert.match(fluxoRouteSource, /const incomingEvaluatorId = resolveExperienceEvaluatorId\(incomingCampos, experienceEvaluators\)/)
assert.match(fluxoRouteSource, /const explicitClearRequested =/)
assert.match(fluxoRouteSource, /const evaluatorId = explicitClearRequested \? '' : incomingEvaluatorId/)
assert.match(fluxoRouteSource, /else if \(explicitClearRequested\) \{\s*\n\s*Object\.assign\(mergedCampos, patchExperienceEvaluationEvaluatorFields\(mergedCampos, null\)\)/)

// Payload canônico deve acompanhar o approverId final persistido.
assert.match(fluxoRouteSource, /const persistedApproverId = resolvedApproverId !== undefined \? resolvedApproverId : solicitation\.approverId/)
assert.match(fluxoRouteSource, /persistedApproverId === null\s*\? null/)
assert.match(fluxoRouteSource, /persistedApproverId\s*\?\s*experienceEvaluators\.find\(\(item\) => item\.id === persistedApproverId\) \?\? \{\s*\n\s*id: persistedApproverId,\s*\n\s*\}/)
assert.match(fluxoRouteSource, /hasExplicitEvaluatorInput && isExperienceEvaluation/)

// Fluxo de avaliação deve limpar responsável assumido para não reaplicar o antigo.
assert.match(fluxoRouteSource, /if \(isExperienceEvaluation\) \{\s*\n\s*resolvedResponsibleId = null\s*\n\s*\}/)

console.log('✅ experience-evaluation-flow-persistence-regression.test passed')
