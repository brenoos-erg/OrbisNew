const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoClientSource = fs.readFileSync(
  'src/app/dashboard/configuracoes/fluxo-solicitacao/FluxoSolicitacaoClient.tsx',
  'utf8',
)

assert.match(fluxoClientSource, /function resolveEvaluatorSelectValue\(/)
assert.match(fluxoClientSource, /function buildEvaluatorFieldPatch\(/)
assert.match(fluxoClientSource, /function buildCamposPayloadForSubmit\(/)
assert.match(fluxoClientSource, /const fromEvaluatorIdField = normalizeText\(editFields\.gestorImediatoAvaliadorId\)/)
assert.match(fluxoClientSource, /const selected = isEvaluatorField\s*\?\s*resolveEvaluatorSelectValue\(field\.name, fieldValue, editFields, resolvedOptions\)/)
assert.match(fluxoClientSource, /return buildEvaluatorFieldPatch\(\s*prev,\s*selectedId,\s*selectedEvaluator\?\.label \?\? '',\s*field\.name,\s*\)/)
assert.match(fluxoClientSource, /campos: buildCamposPayloadForSubmit\(editFields, result\.dataSources\.experienceEvaluators \?\? \[\]\)/)
assert.match(fluxoClientSource, /avaliadorId: normalizedId/)
assert.match(fluxoClientSource, /gestorId: normalizedId/)

console.log('✅ experience-evaluation-flow-select-persistence.test passed')
