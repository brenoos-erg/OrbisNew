const assert = require('node:assert/strict')
const { ModuleLevel } = require('@prisma/client')
function canSeeAction({ me, level, userCenterIds, action }) {
  if (level === ModuleLevel.NIVEL_2 || level === ModuleLevel.NIVEL_3) return true
  return (
    action.createdById === me ||
    action.responsavelId === me ||
    action.nonConformity?.solicitanteId === me ||
    userCenterIds.includes(action.centroResponsavelId) ||
    userCenterIds.includes(action.centroImpactadoId) ||
    userCenterIds.includes(action.nonConformity?.centroQueDetectouId) ||
    userCenterIds.includes(action.nonConformity?.centroQueOriginouId)
  )
}

const baseAction = {
  createdById: 'creator',
  responsavelId: 'owner',
  centroResponsavelId: 'cc-resp',
  centroImpactadoId: 'cc-impact',
  nonConformity: { solicitanteId: 'requester', centroQueDetectouId: 'cc-det', centroQueOriginouId: 'cc-org' },
}

assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_2, userCenterIds: [], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-resp'], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-impact'], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-dept'], action: { ...baseAction, centroResponsavelId: 'cc-dept' } }), true)
assert.equal(canSeeAction({ me: 'owner', level: ModuleLevel.NIVEL_1, userCenterIds: [], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'creator', level: ModuleLevel.NIVEL_1, userCenterIds: [], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'requester', level: ModuleLevel.NIVEL_1, userCenterIds: [], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-det'], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'u', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-org'], action: baseAction }), true)
assert.equal(canSeeAction({ me: 'outsider', level: ModuleLevel.NIVEL_1, userCenterIds: ['cc-other'], action: baseAction }), false)

console.log('ok - sst-action-visibility')
