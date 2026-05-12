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

test('protocolo com assumidaPorId define ação REQUEST', () => {
  assert.strictEqual(resolveSentCancellationAction({ status: 'ABERTA', assumidaPorId: 'agent-1' }).mode, 'REQUEST')
  assert.strictEqual(resolveCancellationAction({ solicitation: solicitation({ status: 'ABERTA', assumidaPorId: 'agent-1' }), userId: 'user-common', userAccess: ctx() }), 'REQUEST')
})

test('protocolo CANCELADA/CONCLUIDA bloqueia cancelamento', () => {
  for (const status of ['CONCLUIDA', 'CANCELADA']) {
    const action = resolveSentCancellationAction({ status })
    assert.strictEqual(action.enabled, false)
    assert.strictEqual(action.title, 'Esta solicitação já está encerrada')
    assert.strictEqual(resolveCancellationAction({ solicitation: solicitation({ status }), userId: 'user-common', userAccess: ctx() }), 'NONE')
  }
})

test('botão Cancelar não depende de selectedRow', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /disabled=\{sessionExpired \|\| !sessionData\?\.appUser\}/, 'botão só depende da sessão')
  assert.doesNotMatch(source, /disabled=\{!cancellationAction\.enabled\}/, 'botão não depende mais da ação da linha selecionada')
  assert.deepStrictEqual(resolveSentCancellationAction(null), {
    enabled: false,
    label: 'Cancelar',
    mode: 'DIRECT',
    title: 'Selecione uma solicitação',
  })
})

test('modal abre sem selectedRow e com protocolo vazio', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /setCancelProtocol\(selectedRow\?\.protocolo \?\? ''\)/, 'protocolo começa vazio sem selectedRow')
  assert.doesNotMatch(source, /if \(!selectedRow \|\| !cancellationAction\.enabled\)/, 'abertura do modal não exige selectedRow')
})

test('modal abre preenchido com selectedRow.protocolo quando há seleção', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /setCancelProtocol\(selectedRow\?\.protocolo \?\? ''\)/, 'usa protocolo da linha selecionada')
  assert.match(source, /\/api\/solicitacoes\/lookup\?protocolo=\$\{encodeURIComponent\(protocolo\)\}/, 'localiza automaticamente quando o protocolo é preenchido')
})

test('modal mostra protocolo, ação, solicitação e placeholder correto', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /Protocolo:/)
  assert.match(source, /Solicitação:/)
  assert.match(source, /Ação que será executada:/)
  assert.match(source, /Status atual:/)
  assert.match(source, /Justificativa obrigatória/)
  assert.match(source, /Descreva o motivo do cancelamento/)
})

test('campos protocolo e justificativa são obrigatórios no modal', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /Informe o protocolo\./, 'protocolo vazio é bloqueado')
  assert.match(source, /Informe a justificativa\./, 'justificativa vazia é bloqueada')
  assert.match(source, /!cancelProtocol\.trim\(\)/, 'confirmar exige protocolo')
  assert.match(source, /!cancelReason\.trim\(\)/, 'confirmar exige justificativa')
  assert.throws(() => assertRequiredReason('   '), /Informe o motivo do cancelamento/)
  assert.throws(() => assertRequiredReason('', 'justificativa'), /Informe a justificativa/)
})

test('protocolo ABERTA sem assumidaPorId define ação DIRECT', () => {
  const action = resolveCancellationAction({ solicitation: solicitation({ status: 'ABERTA' }), userId: 'user-common', userAccess: ctx() })
  assert.strictEqual(action, 'DIRECT')
})

test('protocolo EM_ATENDIMENTO define ação REQUEST', () => {
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

test('tabela de enviadas tem seleção explícita por coluna, radio e clique simples', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /<th>Selecionar<\/th>/, 'existe coluna Selecionar')
  assert.match(source, /type="radio"[\s\S]*name="selectedSolicitation"/, 'existe input radio com name selectedSolicitation')
  assert.match(source, /checked=\{selectedRow\?\.id === r\.id\}/, 'radio reflete a linha selecionada')
  assert.match(source, /onChange=\{\(\) => setSelectedRow\(r\)\}/, 'radio chama setSelectedRow(r)')
  assert.match(source, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/, 'clique no radio não propaga para a linha')
  assert.match(source, /onClick=\{\(\) => \{\s*setSelectedRow\(r\)\s*\}\}/s, 'clique simples na linha seleciona')
  assert.match(source, /onDoubleClick=\{\(\) => \{\s*openDetail\(r\)\s*\}\}/s, 'duplo clique na linha abre detalhe')
  assert.doesNotMatch(source, /<tr[^>]+onClick=\{\(\) => openDetail\(r\)\}/s, 'clique simples não abre detalhe')
})

test('tabela de enviadas mostra estado de seleção e ajusta 8 colunas', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /Selecionado: /, 'aparece texto Selecionado: quando há selectedRow')
  assert.match(source, /Nenhuma solicitação selecionada/, 'aparece texto quando não há selectedRow')
  assert.match(source, /TableSkeletonRows columns=\{8\}/, 'skeleton usa 8 colunas')
  assert.match(source, /colSpan=\{8\}/, 'estado vazio usa colSpan 8')
  assert.match(source, /app-table-row-selected/, 'linha selecionada recebe destaque visual')
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

test('lookup por protocolo retorna solicitação permitida e payload mínimo', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/api/solicitacoes/lookup/route.ts'), 'utf8')
  assert.match(source, /withModuleLevel\([\s\S]*'solicitacoes'[\s\S]*ModuleLevel\.NIVEL_1/, 'lookup exige acesso ao módulo Solicitações')
  assert.match(source, /where: \{ protocolo \}/, 'lookup busca protocolo exato normalizado')
  assert.match(source, /canViewSolicitation\(userAccess, solicitation\)/, 'lookup valida visibilidade')
  for (const field of ['id', 'protocolo', 'titulo', 'status', 'assumidaPorId', 'cancelamentoStatus', 'tipo', 'setorDestino', 'responsavel']) {
    assert.match(source, new RegExp(`${field}:`), `lookup retorna ${field}`)
  }
})

test('lookup retorna 404 para protocolo inexistente e 403 para usuário sem visibilidade', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/api/solicitacoes/lookup/route.ts'), 'utf8')
  assert.match(source, /Solicitação não encontrada\.[\s\S]*status: 404/, 'lookup retorna 404')
  assert.match(source, /Você não possui permissão para visualizar\/cancelar esta solicitação\.[\s\S]*status: 403/, 'lookup retorna 403')
})

test('submit DIRECT chama cancelar e submit REQUEST chama solicitar-cancelamento', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /cancelLookupAction\.mode === 'REQUEST'[\s\S]*\/solicitar-cancelamento/, 'REQUEST chama solicitação de cancelamento')
  assert.match(source, /:\s*`\/api\/solicitacoes\/\$\{cancelLookup\.id\}\/cancelar`/, 'DIRECT chama cancelar')
  assert.match(source, /motivo, tipo: 'DIRETO'/, 'DIRECT envia tipo DIRETO')
})

test('sucesso fecha modal, limpa campos e recarrega lista', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/solicitacoes/enviadas/page.tsx'), 'utf8')
  assert.match(source, /resetCancellationModal\(\)[\s\S]*await load\(currentSearchState\)/, 'sucesso reseta modal e recarrega')
})
