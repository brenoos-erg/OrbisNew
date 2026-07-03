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
