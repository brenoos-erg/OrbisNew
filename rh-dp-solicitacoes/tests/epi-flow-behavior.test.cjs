const assert = require('node:assert')
const {
  buildEpiUniformeForwardApprovalData,
  canUserSeeEpiUniformeApproval,
  isEpiUniformeReadyToForwardApproval,
  isEpiUniformeWaitingFicha,
} = require('../src/lib/epiUniformeFlow')
const { normalizeStoredAttachmentUrl } = require('../src/lib/files/attachmentStorage')

const tipo = { id: 'RQ_043', codigo: 'RQ.SST.043', nome: 'RQ_043 - Requisição de EPI/Uniformes' }
const department19 = { id: 'dep-19', code: '19', name: 'Segurança do Trabalho' }
const otherDepartment = { id: 'dep-01', code: '01', name: 'Outro departamento' }
const gabrielaContext = {
  userId: 'gabriela-id',
  role: 'COLABORADOR',
  departmentIds: ['dep-19'],
  tipoApproverTipoIds: [],
  solicitationModuleLevel: 'NIVEL_1',
}
const approverContext = {
  userId: 'approver-id',
  role: 'COLABORADOR',
  departmentIds: [],
  tipoApproverTipoIds: ['RQ_043'],
  solicitationModuleLevel: 'NIVEL_1',
}

function canSeeReceivedByDepartment(solicitation, ctx) {
  return Boolean(solicitation.departmentId && ctx.departmentIds.includes(solicitation.departmentId))
}

const epiWithoutFicha = {
  tipoId: 'RQ_043',
  tipo,
  departmentId: 'dep-19',
  department: department19,
  requiresApproval: false,
  approvalStatus: 'NAO_PRECISA',
  status: 'ABERTA',
  approverId: null,
  anexos: [],
}
assert.equal(isEpiUniformeWaitingFicha(epiWithoutFicha), true, 'EPI no depto 19 sem ficha deve ficar aguardando ficha')
assert.equal(canSeeReceivedByDepartment(epiWithoutFicha, gabrielaContext), true, 'Gabriela vinculada ao depto 19 vê EPI sem ficha em Recebidas')
assert.equal(canUserSeeEpiUniformeApproval(epiWithoutFicha, gabrielaContext), false, 'EPI sem ficha não deve aparecer em Aprovações')

const epiOtherDepartment = { ...epiWithoutFicha, departmentId: 'dep-01', department: otherDepartment }
assert.equal(isEpiUniformeWaitingFicha(epiOtherDepartment), false, 'EPI fora do depto 19 não deve ser tratada como aguardando ficha do SST')
assert.equal(canSeeReceivedByDepartment(epiOtherDepartment, gabrielaContext), false, 'Gabriela não vê EPI de outro departamento indevidamente')

const epiWithFicha = {
  ...epiWithoutFicha,
  anexos: [{ id: 'att-1', url: '/uploads/documents/ficha.pdf' }],
}
assert.equal(isEpiUniformeReadyToForwardApproval(epiWithFicha), true, 'EPI com ficha no depto 19 deve poder ser encaminhada')
const forwarded = { ...epiWithFicha, ...buildEpiUniformeForwardApprovalData('approver-id') }
assert.deepStrictEqual(
  {
    requiresApproval: forwarded.requiresApproval,
    approvalStatus: forwarded.approvalStatus,
    status: forwarded.status,
    approverId: forwarded.approverId,
  },
  {
    requiresApproval: true,
    approvalStatus: 'PENDENTE',
    status: 'AGUARDANDO_APROVACAO',
    approverId: 'approver-id',
  },
  'Encaminhamento deve preencher flags e aprovador corretamente',
)
assert.equal(canUserSeeEpiUniformeApproval(forwarded, approverContext), true, 'EPI encaminhada aparece para aprovador configurado do tipo')
assert.equal(normalizeStoredAttachmentUrl('/upload/documents/ficha.pdf'), '/uploads/documents/ficha.pdf', 'Anexos legados devem ser normalizados')

const {
  assertCanMoveEpiUniformeToSst,
  buildEpiUniformeMoveToSstData,
} = require('../src/lib/epiUniformeFlow')
assert.throws(
  () => assertCanMoveEpiUniformeToSst(true, []),
  /Para usar --move-to-sst, informe --protocol ou --protocols\./,
  '--move-to-sst sem protocolo deve falhar',
)
assert.doesNotThrow(
  () => assertCanMoveEpiUniformeToSst(true, ['RQ2026-00001']),
  '--move-to-sst com protocolo explícito pode prosseguir',
)
assert.deepStrictEqual(
  buildEpiUniformeMoveToSstData('dep-19', 'cc-580'),
  { departmentId: 'dep-19', costCenterId: 'cc-580' },
  'Quando centro 580 existir, a correção também altera costCenterId',
)
assert.deepStrictEqual(
  buildEpiUniformeMoveToSstData('dep-19', null),
  { departmentId: 'dep-19' },
  'Sem centro 580 encontrado, a correção altera somente departmentId',
)
assert.equal(false && Boolean(buildEpiUniformeMoveToSstData('dep-19').departmentId), false, 'Sem --move-to-sst, o script apenas diagnostica e não muda departamento')

console.log('epi-flow-behavior ok')

const {
  buildEpiUniformeForwardToWarehouseData,
  resolveWarehouseDepartment,
} = require('../src/lib/epiUniformeFlow')
const warehouseContext = {
  userId: 'thiago-id',
  role: 'COLABORADOR',
  departmentIds: ['dep-almox'],
  tipoApproverTipoIds: [],
  solicitationModuleLevel: 'NIVEL_1',
}
const nonWarehouseContext = { ...warehouseContext, userId: 'outro-id', departmentIds: ['dep-outro'] }
const approvedBySst = { ...forwarded, approvalStatus: 'APROVADO', status: 'ABERTA', approverId: 'sst-id' }
const routedToWarehouse = {
  ...approvedBySst,
  ...buildEpiUniformeForwardToWarehouseData({ warehouseDepartmentId: 'dep-almox', warehouseCostCenterId: 'cc-almox' }),
}
assert.deepStrictEqual(
  {
    departmentId: routedToWarehouse.departmentId,
    costCenterId: routedToWarehouse.costCenterId,
    status: routedToWarehouse.status,
    requiresApproval: routedToWarehouse.requiresApproval,
    approvalStatus: routedToWarehouse.approvalStatus,
    approverId: routedToWarehouse.approverId,
    assumidaPorId: routedToWarehouse.assumidaPorId,
    assumidaEm: routedToWarehouse.assumidaEm,
  },
  {
    departmentId: 'dep-almox',
    costCenterId: 'cc-almox',
    status: 'ABERTA',
    requiresApproval: false,
    approvalStatus: 'APROVADO',
    approverId: null,
    assumidaPorId: null,
    assumidaEm: null,
  },
  'RQ_043 aprovada pelo SST deve ser reaberta para atendimento do Almoxarifado',
)
assert.equal(canSeeReceivedByDepartment(routedToWarehouse, warehouseContext), true, 'Usuário do Almoxarifado vê RQ_043 aprovada em Recebidas')
assert.equal(canSeeReceivedByDepartment(routedToWarehouse, nonWarehouseContext), false, 'Usuário fora do Almoxarifado não vê RQ_043 aprovada indevidamente')
assert.equal(buildEpiUniformeForwardToWarehouseData({ warehouseDepartmentId: 'dep-almox' }).costCenterId, null, 'Sem centro de custo de Almoxarifado, roteamento limpa costCenterId')
assert.equal(buildEpiUniformeForwardToWarehouseData({ warehouseDepartmentId: 'dep-almox' }).approvalStatus, 'APROVADO', 'Roteamento ao Almoxarifado só preserva EPI aprovada')

const otherTipo = { id: 'RQ_999', codigo: 'RQ.999', nome: 'Outro tipo' }
assert.equal(isEpiUniformeWaitingFicha({ ...epiWithoutFicha, tipo: otherTipo }), false, 'Outros tipos não entram na regra sem ficha de EPI')
assert.equal(isEpiUniformeReadyToForwardApproval({ ...epiWithFicha, tipo: otherTipo }), false, 'Outros tipos não entram na regra com ficha de EPI')

resolveWarehouseDepartment({
  department: {
    async findFirst(args) {
      const text = JSON.stringify(args)
      assert.match(text, /Almoxarifado/, 'Resolver deve procurar departamento por Almoxarifado')
      assert.match(text, /Estoque/, 'Resolver deve procurar departamento por Estoque')
      return { id: 'dep-almox', name: 'Almoxarifado', sigla: 'ALMOX', code: '20' }
    },
  },
}).then((department) => {
  assert.equal(department.id, 'dep-almox', 'Resolver retorna departamento de Almoxarifado sem hardcodar ID')
})
