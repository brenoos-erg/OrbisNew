const assert = require('node:assert/strict')
const fs = require('node:fs')

const fluxoClientSource = fs.readFileSync(
  'src/app/dashboard/configuracoes/fluxo-solicitacao/FluxoSolicitacaoClient.tsx',
  'utf8',
)

assert.match(fluxoClientSource, /function resolveEvaluatorSelectValue\(/)
assert.match(fluxoClientSource, /const fromEvaluatorIdField = normalizeText\(editFields\.gestorImediatoAvaliadorId\)/)
assert.match(fluxoClientSource, /const selected = isEvaluatorField\s*\?\s*resolveEvaluatorSelectValue\(field\.name, fieldValue, editFields, resolvedOptions\)/)
assert.match(fluxoClientSource, /field\.name === 'gestorImediatoAvaliador'\s*\?\s*selectedEvaluator\?\.label \?\? ''\s*:\s*selectedId/)
assert.match(fluxoClientSource, /gestorImediatoAvaliadorId: selectedId/)
assert.match(fluxoClientSource, /gestorImediatoAvaliador: selectedEvaluator\?\.label \?\? ''/)

console.log('✅ experience-evaluation-flow-select-persistence.test passed')
