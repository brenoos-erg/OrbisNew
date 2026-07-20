require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const policy = require('../src/lib/solicitationAccessPolicy')
const {
  canExecuteSolicitationRouteAction,
  executeAuthorizedSolicitationRouteWrite,
} = require('../src/lib/solicitationRouteActionAuthorization')

function ctx(overrides = {}) {
  return {
    userId: 'viewer-logistica',
    role: 'COLABORADOR',
    userDepartmentIds: ['dept-logistica'],
    userCostCenterIds: ['cc-logistica'],
    userSetorKeys: ['LOGISTICA'],
    allowedTipoIds: ['RQ_SST_043'],
    viewerTipoIds: ['RQ_SST_043'],
    actionableTipoIds: [],
    finalizerTipoIds: [],
    hasSolicitationsModuleAccess: true,
    ...overrides,
  }
}

function solicitation(overrides = {}) {
  return {
    tipoId: 'RQ_SST_043',
    tipo: { id: 'RQ_SST_043', codigo: 'RQ.SST.043', nome: 'EPI / Uniformes' },
    status: 'EM_ATENDIMENTO',
    solicitanteId: 'requester',
    approverId: null,
    assumidaPorId: null,
    departmentId: 'dept-sst',
    costCenterId: 'cc-sst',
    solicitacaoSetores: [{ setor: 'SST', status: 'PENDENTE' }],
    payload: {},
    ...overrides,
  }
}


const routeFiles = {
  assumir: 'src/app/api/solicitacoes/[id]/assumir/route.ts',
  atualizarCampos: 'src/app/api/solicitacoes/[id]/atualizar-campos/route.ts',
  comentarios: 'src/app/api/solicitacoes/[id]/comentarios/route.ts',
  anexos: 'src/app/api/solicitacoes/[id]/anexos/route.ts',
  finalizar: 'src/app/api/solicitacoes/[id]/finalizar/route.ts',
}
for (const [action, routeFile] of Object.entries(routeFiles)) {
  const source = fs.readFileSync(path.join(__dirname, '..', routeFile), 'utf8')
  assert.match(source, /canExecuteSolicitationRouteAction/, `${action}: rota real deve usar o helper comportamental testado`)
  assert.ok(source.includes(`canExecuteSolicitationRouteAction('${action}'`), `${action}: rota real deve chamar a ação específica testada`)
}

const routeActions = ['assumir', 'comentarios', 'atualizarCampos', 'anexos', 'aprovar', 'finalizar']

function createWriteMock() {
  const calls = { create: 0, update: 0, delete: 0, status: 0 }
  return {
    calls,
    async write() {
      calls.create += 1
      calls.update += 1
      calls.delete += 1
      calls.status += 1
      return { ok: true }
    },
  }
}

async function assertRouteBlocksWithoutWriting(action, userAccess, solic, label) {
  const writeMock = createWriteMock()
  const result = await executeAuthorizedSolicitationRouteWrite({ action, ctx: userAccess, solicitation: solic, write: writeMock.write })
  assert.equal(result.status, 403, `${label}: deve retornar 403`)
  assert.equal(result.ok, false, `${label}: deve bloquear a operação`)
  assert.deepEqual(writeMock.calls, { create: 0, update: 0, delete: 0, status: 0 }, `${label}: não deve chamar create/update/delete nem alterar status`)
}

async function assertRouteWritesOnlyWhenPolicyAllows(action, userAccess, solic, label) {
  const writeMock = createWriteMock()
  const result = await executeAuthorizedSolicitationRouteWrite({ action, ctx: userAccess, solicitation: solic, write: writeMock.write })
  const expectedAllowed = canExecuteSolicitationRouteAction(action, userAccess, solic)
  assert.equal(result.ok, expectedAllowed, `${label}: resultado deve seguir a política específica da ação`)
  assert.deepEqual(
    writeMock.calls,
    expectedAllowed ? { create: 1, update: 1, delete: 1, status: 1 } : { create: 0, update: 0, delete: 0, status: 0 },
    `${label}: escrita deve ocorrer somente quando a política específica permitir`,
  )
}

;(async () => {
  const outside = solicitation()
  for (const action of routeActions) {
    await assertRouteBlocksWithoutWriting(action, ctx(), outside, `${action}: VIEWER fora do setor`)
  }

  const currentSector = solicitation({
    departmentId: 'dept-logistica',
    costCenterId: 'cc-logistica',
    solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'PENDENTE' }],
  })
  const viewerInSector = ctx()
  const sameUserWithoutViewer = ctx({ allowedTipoIds: [], viewerTipoIds: [] })
  assert.equal(policy.isViewerOnlyByPolicy(viewerInSector, currentSector), false, 'VIEWER no setor atual não deve receber erro genérico de VIEWER')
  for (const action of routeActions) {
    assert.equal(
      canExecuteSolicitationRouteAction(action, viewerInSector, currentSector),
      canExecuteSolicitationRouteAction(action, sameUserWithoutViewer, currentSector),
      `${action}: VIEWER no setor deve seguir a mesma política específica de usuário equivalente sem VIEWER`,
    )
    await assertRouteWritesOnlyWhenPolicyAllows(action, viewerInSector, currentSector, `${action}: VIEWER no setor atual`)
  }

  const typeApproverOutside = ctx({ actionableTipoIds: ['RQ_SST_043'] })
  assert.equal(policy.canApproveSolicitation(typeApproverOutside, outside), true, 'VIEWER + APPROVER do tipo fora do setor pode aprovar quando aplicável')
  assert.equal(policy.canAssumeSolicitation(typeApproverOutside, outside), false, 'VIEWER + APPROVER do tipo fora do setor não pode assumir')
  assert.equal(policy.canEditSolicitation(typeApproverOutside, outside), false, 'VIEWER + APPROVER do tipo fora do setor não pode editar')
  assert.equal(policy.canCommentSolicitation(typeApproverOutside, outside), false, 'VIEWER + APPROVER do tipo fora do setor não pode comentar')
  assert.equal(policy.canFinalizeSolicitation(typeApproverOutside, outside), false, 'VIEWER + APPROVER do tipo fora do setor não pode finalizar')
  assert.equal(policy.canCancelSolicitation(typeApproverOutside, outside), false, 'VIEWER + APPROVER do tipo fora do setor não pode cancelar')
  for (const action of ['assumir', 'comentarios', 'atualizarCampos', 'anexos', 'finalizar']) {
    await assertRouteBlocksWithoutWriting(action, typeApproverOutside, outside, `${action}: VIEWER + APPROVER fora do setor`)
  }
  await assertRouteWritesOnlyWhenPolicyAllows('aprovar', typeApproverOutside, outside, 'aprovar: VIEWER + APPROVER fora do setor')

  const approverIdOutside = solicitation({ approverId: 'viewer-logistica' })
  assert.equal(policy.isViewerOnlyByPolicy(ctx(), approverIdOutside), false, 'approverId pode remover viewerOnly para aprovação')
  assert.equal(policy.canApproveSolicitation(ctx(), approverIdOutside), true, 'aprovar: VIEWER + approverId fora do setor pode aprovar')
  assert.equal(policy.canEditSolicitation(ctx(), approverIdOutside), false, 'atualizar/anexos: approverId fora do setor bloqueado')
  assert.equal(policy.canCommentSolicitation(ctx(), approverIdOutside), true, 'comentários: approverId fora do setor preserva comportamento anterior')
  assert.equal(policy.canFinalizeSolicitation(ctx(), approverIdOutside), false, 'finalizar: approverId fora do setor bloqueado')
  assert.equal(policy.canCancelSolicitation(ctx(), approverIdOutside), false, 'cancelar: approverId fora do setor bloqueado')
  await assertRouteWritesOnlyWhenPolicyAllows('comentarios', ctx(), approverIdOutside, 'comentários: approverId fora do setor')

  const historical = solicitation({ solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'CONCLUIDO', finalizadoEm: '2026-01-01T00:00:00.000Z' }] })
  for (const action of routeActions) {
    await assertRouteBlocksWithoutWriting(action, ctx(), historical, `${action}: setor histórico concluído`)
  }

  console.log('✅ viewer-route-permissions-behavior.test passed')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
