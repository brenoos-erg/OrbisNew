const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoRouteSource = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')

// GET precisa priorizar o approverId canônico para evitar reidratar avaliador antigo.
assert.match(fluxoRouteSource, /const canonicalApproverId = normalizeStringValue\(solicitation\.approverId\)/)
assert.match(fluxoRouteSource, /const resolvedEvaluatorId =\s*\n\s*\(canonicalApproverId && experienceEvaluators\.some\(\(item\) => item\.id === canonicalApproverId\)/)

// PATCH precisa resolver o avaliador a partir do payload recebido no form (nome/id novos) antes de fallback no merged.
assert.match(fluxoRouteSource, /const incomingEvaluatorId = resolveExperienceEvaluatorId\(incomingCampos, experienceEvaluators\)/)
assert.match(fluxoRouteSource, /const evaluatorId =\s*\n\s*incomingEvaluatorId \|\| resolveExperienceEvaluatorId\(mergedCampos, experienceEvaluators\)/)

// Payload canônico deve acompanhar o approverId final persistido.
assert.match(fluxoRouteSource, /resolvedApproverId === null\s*\? null/)
assert.match(fluxoRouteSource, /resolvedApproverId\s*\?\s*experienceEvaluators\.find\(\(item\) => item\.id === resolvedApproverId\) \?\? \{\s*\n\s*id: resolvedApproverId,\s*\n\s*\}/)

// Fluxo de avaliação deve limpar responsável assumido para não reaplicar o antigo.
assert.match(fluxoRouteSource, /if \(isExperienceEvaluation\) \{\s*\n\s*resolvedResponsibleId = null\s*\n\s*\}/)

console.log('✅ experience-evaluation-flow-persistence-regression.test passed')
