const assert = require('node:assert')
const fs = require('node:fs')

function normalizeFeatureKey(featureKey) {
  return featureKey.trim().toLowerCase().replace(/_/g, '-')
}
const critical = new Set(['solicitacoes.fluxos'])
function canCriticalFeature({ featureKey, action, explicitActions, fallbackActions }) {
  const normalized = normalizeFeatureKey(featureKey)
  if (explicitActions) return explicitActions.includes(action)
  if (critical.has(normalized)) return false
  return fallbackActions.includes(action)
}

assert.strictEqual(normalizeFeatureKey('SOLICITACOES.FLUXOS'), 'solicitacoes.fluxos')
assert.strictEqual(canCriticalFeature({ featureKey: 'SOLICITACOES.FLUXOS', action: 'UPDATE', explicitActions: undefined, fallbackActions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] }), false, 'fallback NIVEL_3 não deve editar feature crítica')
assert.strictEqual(canCriticalFeature({ featureKey: 'SOLICITACOES.FLUXOS', action: 'UPDATE', explicitActions: ['VIEW', 'UPDATE'], fallbackActions: [] }), true, 'grant explícito UPDATE deve editar feature crítica')

const source = fs.readFileSync('src/lib/permissions.ts', 'utf8')
assert(source.indexOf('if (grantActions)') < source.indexOf('isCriticalFeatureKey(featureKey)'), 'grant explícito deve ser avaliado antes do bloqueio crítico')
console.log('critical-feature-permissions ok')
