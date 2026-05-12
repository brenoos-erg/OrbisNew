const assert = require('assert')
const fs = require('fs')
const path = require('path')

const { resolveSentCancellationAction } = require('../src/lib/sentCancellationAction')
const {
  assertRequiredReason,
  resolveCancellationAction,
} = require('../src/lib/solicitationCancellation')
const {
  canCancelSolicitation,
  canManageCancellationRequest,
} = require('../src/lib/solicitationAccessPolicy')
const { buildSolicitationDetailPayload } = require('../src/lib/solicitationDetailPayload')

function ctx(overrides = {}) {
  return {
    userId: 'user-common',
    role: 'USER',
    userDepartmentIds: [],
    userSetorKeys: [],
    finalizerTipoIds: [],
    allowedTipoIds: ['tipo-visible'],
    viewerTipoIds: [],
    actionableTipoIds: [],
    isExperienceEvaluationCoordinator: false,
    hasSolicitationsModuleAccess: true,
    ...overrides,
  }
}

function solicitation(overrides = {}) {
  return {
    id: 'sol-1',
    tipoId: 'tipo-visible',
    status: 'ABERTA',
    solicitanteId: 'requester-other',
    assumidaPorId: null,
    departmentId: 'department-a',
    solicitacaoSetores: [],
    payload: {},
    ...overrides,
  }
}

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('usuário comum com acesso a Solicitações e visibilidade pode acionar cancelamento em solicitação ABERTA', () => {
  assert.strictEqual(canCancelSolicitation(ctx(), solicitation()), true)
})

test('solicitação ABERTA gera mode DIRECT e label Cancelar no frontend e no backend', () => {
  assert.deepStrictEqual(resolveSentCancellationAction({ status: 'ABERTA' }), {
    enabled: true,
    label: 'Cancelar',
    mode: 'DIRECT',
    title: 'Cancelar solicitação',
  })
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation(), userId: 'user-common', userAccess: ctx() }), 'DIRECT')
})

test('solicitação EM_ATENDIMENTO gera mode REQUEST e label Solicitar cancelamento', () => {
  assert.deepStrictEqual(resolveSentCancellationAction({ status: 'EM_ATENDIMENTO' }), {
    enabled: true,
    label: 'Solicitar cancelamento',
    mode: 'REQUEST',
    title: 'Solicitar cancelamento',
  })
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation({ status: 'EM_ATENDIMENTO' }), userId: 'user-common', userAccess: ctx() }), 'REQUEST')
})

test('solicitação assumida gera mode REQUEST mesmo com status inicial', () => {
  assert.strictEqual(resolveSentCancellationAction({ status: 'ABERTA', assumidaPorId: 'agent-1' }).mode, 'REQUEST')
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation({ status: 'ABERTA', assumidaPorId: 'agent-1' }), userId: 'user-common', userAccess: ctx() }), 'REQUEST')
})

test('solicitação CONCLUIDA/CANCELADA deixa botão desabilitado e backend sem ação', () => {
  for (const status of ['CONCLUIDA', 'CANCELADA']) {
    const action = resolveSentCancellationAction({ status })
    assert.strictEqual(action.enabled, false)
    assert.strictEqual(action.title, 'Esta solicitação já está encerrada')
    assert.strictEqual(resolveCancellationAction({ solicitation: solicitation({ status }), userId: 'user-common', userAccess: ctx() }), 'NONE')
  }
})

test('sem selectedRow o botão fica desabilitado com título de seleção', () => {
  assert.deepStrictEqual(resolveSentCancellationAction(null), {
    enabled: false,
    label: 'Cancelar',
    mode: 'DIRECT',
    title: 'Selecione uma solicitação',
  })
})

test('modal mostra protocolo, ação, solicitação e placeholder correto', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /Protocolo:/)
  assert.match(source, /Solicitação:/)
  assert.match(source, /Ação:/)
  assert.match(source, /Descreva o motivo do cancelamento/)
})

test('justificativa vazia bloqueia envio', () => {
  assert.throws(() => assertRequiredReason('   '), /Informe o motivo do cancelamento/)
  assert.throws(() => assertRequiredReason('', 'justificativa'), /Informe a justificativa/)
})

test('endpoint cancelar permite DIRECT para usuário com acesso mínimo e visibilidade', () => {
  const action = resolveCancellationAction({ solicitation: solicitation({ status: 'ABERTA' }), userId: 'user-common', userAccess: ctx() })
  assert.strictEqual(action, 'DIRECT')
})

test('endpoint solicitar-cancelamento permite REQUEST para usuário com acesso mínimo e visibilidade', () => {
  const action = resolveCancellationAction({ solicitation: solicitation({ status: 'EM_ATENDIMENTO' }), userId: 'user-common', userAccess: ctx() })
  assert.strictEqual(action, 'REQUEST')
})

test('visualizador puro não pode cancelar nem solicitar cancelamento', () => {
  const viewerCtx = ctx({ viewerTipoIds: ['tipo-visible'], allowedTipoIds: ['tipo-visible'] })
  assert.strictEqual(canCancelSolicitation(viewerCtx, solicitation()), false)
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation(), userId: 'viewer', userAccess: viewerCtx }), 'NONE')
})

test('pedido de cancelamento pendente aparece no detalhe com protocolo e motivo', () => {
  const detail = buildSolicitationDetailPayload({
    item: {
      id: 'sol-1',
      protocolo: 'RQ2026-00001',
      titulo: 'Solicitação teste',
      status: 'EM_ATENDIMENTO',
      tipoId: 'tipo-visible',
      departmentId: 'department-a',
      solicitanteId: 'requester-other',
      payload: {},
      cancelamentoStatus: 'PENDENTE',
      cancelamentoSolicitadoPorId: 'user-common',
      cancelamentoSolicitadoEm: new Date('2026-05-12T10:00:00Z'),
      cancelamentoMotivo: 'Motivo informado',
    },
    permissions: {
      viewerOnly: false,
      canAssume: false,
      canEdit: false,
      canApprove: false,
      canFinalize: false,
      canCancel: true,
      canManageCancellationRequest: false,
      canComment: false,
    },
  })
  assert.strictEqual(detail.cancelamentoStatus, 'PENDENTE')
  assert.strictEqual(detail.protocolo, 'RQ2026-00001')
  assert.strictEqual(detail.cancelamentoMotivo, 'Motivo informado')
})

test('setor responsável aprova pedido', () => {
  const managerCtx = ctx({ userId: 'manager', userDepartmentIds: ['department-a'] })
  assert.strictEqual(canManageCancellationRequest(managerCtx, solicitation({ status: 'EM_ATENDIMENTO', cancelamentoStatus: 'PENDENTE' })), true)
})

test('setor responsável recusa pedido', () => {
  const managerCtx = ctx({ userId: 'manager', actionableTipoIds: ['tipo-visible'] })
  assert.strictEqual(canManageCancellationRequest(managerCtx, solicitation({ status: 'EM_ATENDIMENTO', cancelamentoStatus: 'PENDENTE' })), true)
})

test('permissões continuam bloqueando usuário sem acesso ao módulo ou sem visibilidade', () => {
  assert.strictEqual(canCancelSolicitation(ctx({ hasSolicitationsModuleAccess: false }), solicitation()), false)
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation(), userId: 'user-common', userAccess: ctx({ hasSolicitationsModuleAccess: false }) }), 'NONE')
  assert.strictEqual(canCancelSolicitation(ctx({ allowedTipoIds: [] }), solicitation()), false)
})

test('tabela de enviadas seleciona com clique simples e abre detalhe somente no duplo clique', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /onClick=\{\(\) => \{\s*setSelectedRow\(r\)\s*\}\}/s)
  assert.match(source, /onDoubleClick=\{\(\) => \{\s*openDetail\(r\)\s*\}\}/s)
  assert.doesNotMatch(source, /<tr[^>]+onClick=\{\(\) => openDetail\(r\)\}/s)
})

test('botão Detalhes abre o detalhe da linha selecionada', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /if \(!selectedRow\) \{\s*pushToast\('Selecione uma solicitação na tabela', 'info'\)\s*return\s*\}\s*openDetail\(selectedRow\)/s)
})

test('recarregamento mantém seleção existente ou limpa quando a solicitação sai da lista', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /setSelectedRow\(\(current\) => \{\s*if \(!current\) return current\s*return rows\.find\(\(row\) => row\.id === current\.id\) \?\? null\s*\}\)/s)
})

test('API de solicitações retorna campos necessários para decidir cancelamento no frontend', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/api/solicitacoes/route.ts'), 'utf8')
  for (const field of ['id', 'status', 'protocolo', 'titulo', 'tipo', 'assumidaPorId', 'cancelamentoStatus']) {
    assert.match(source, new RegExp(`${field}:`), `campo ${field} deve estar no payload da lista`)
  }
})
