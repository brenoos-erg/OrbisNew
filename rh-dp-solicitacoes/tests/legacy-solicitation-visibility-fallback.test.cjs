const assert = require('node:assert/strict')

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node',
})
require('ts-node/register/transpile-only')

const {
  canUserViewSolicitationByFallback,
} = require('../src/lib/solicitationVisibility.ts')

const coordinator = {
  userId: 'user-coordenador',
  departmentIds: ['dept-atual'],
  costCenterIds: ['cc-atual'],
  nadaConstaSetores: ['DP'],
  tipoFinalizerTipoIds: ['RQ_063'],
  sharedRhDpDepartmentIds: ['dept-rh'],
  isAdminTechnical: false,
}

function legacySolicitation(overrides = {}) {
  return {
    id: 'sol-legacy',
    protocolo: 'RQ2026-01410',
    tipoId: 'RQ_063',
    solicitanteId: 'solicitante',
    assumidaPorId: null,
    approverId: null,
    departmentId: 'outro-dept',
    costCenterId: 'outro-cc',
    solicitacaoSetores: [],
    ...overrides,
  }
}

function assertCanView(ctx, solicitation, reason) {
  const result = canUserViewSolicitationByFallback(ctx, solicitation)
  assert.equal(result.canView, true)
  assert.ok(result.reasons.includes(reason), result.reasons.join(', '))
  assert.ok(result.reasons.includes('LEGACY_FALLBACK'))
}

assertCanView(
  coordinator,
  legacySolicitation({ departmentId: 'dept-atual' }),
  'CURRENT_DEPARTMENT',
)

assertCanView(
  coordinator,
  legacySolicitation({ costCenterId: 'cc-atual' }),
  'CURRENT_COST_CENTER',
)

assertCanView(
  coordinator,
  legacySolicitation({ approverId: coordinator.userId }),
  'APPROVER',
)

assertCanView(
  coordinator,
  legacySolicitation({ assumidaPorId: coordinator.userId }),
  'ASSIGNED_USER',
)

assertCanView(
  coordinator,
  legacySolicitation({ tipoId: 'RQ_063' }),
  'TIPO_FINALIZER',
)

assertCanView(
  coordinator,
  legacySolicitation({
    protocolo: 'RQ2026-01411',
    departmentId: 'dept-rh',
  }),
  'SHARED_RH_DP_FLOW',
)

assertCanView(
  coordinator,
  legacySolicitation({
    tipoId: 'RQ_300',
    solicitacaoSetores: [{ setor: 'DP' }],
  }),
  'NADA_CONSTA_SECTOR',
)

const requesterResult = canUserViewSolicitationByFallback(
  { userId: 'solicitante' },
  legacySolicitation(),
)
assert.equal(requesterResult.canView, true)
assert.ok(requesterResult.reasons.includes('REQUESTER'))

const unrelatedResult = canUserViewSolicitationByFallback(
  {
    userId: 'sem-vinculo',
    departmentIds: ['sem-dept'],
    costCenterIds: ['sem-cc'],
    nadaConstaSetores: ['TI'],
  },
  legacySolicitation(),
)
assert.equal(unrelatedResult.canView, false)
assert.deepEqual(unrelatedResult.reasons, [])

console.log('legacy-solicitation-visibility-fallback: ok')
