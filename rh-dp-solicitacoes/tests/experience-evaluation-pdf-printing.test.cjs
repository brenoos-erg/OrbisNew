require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {
  hasExperienceEvaluationPrintableData,
  normalizeExperienceEvaluationPayload,
} = require('../src/lib/experienceEvaluation.shared')
const { extractExperienceEvaluationData } = require('../src/lib/experienceEvaluationForm')
const { canPrintExperienceEvaluationPdf } = require('../src/lib/solicitationAccessPolicy')

const oldPayload = {
  campos: {
    colaboradorAvaliado: 'Colaborador RQ2026-00203',
    contratoSetor: 'Contrato / Setor legado',
    gestorImediatoAvaliador: 'Gestor texto legado',
    cargoColaborador: 'Analista',
    dataAdmissao: '2026-01-05',
    cargoAvaliador: 'Coordenador',
  },
  avaliacaoGestor: {
    relacionamentoNota: 'PLENA',
    comunicacaoNota: 'PARCIAL',
    atitudeNota: 'PLENA',
    saudeSegurancaNota: 'ACIMA DA MÉDIA',
    dominioTecnicoProcessosNota: 'PLENA',
    adaptacaoMudancaNota: 'PLENA',
    autogestaoGestaoPessoasNota: 'PARCIAL',
    comentarioFinal: '',
  },
}

assert.deepEqual(normalizeExperienceEvaluationPayload(oldPayload), {
  colaboradorAvaliado: 'Colaborador RQ2026-00203',
  contratoSetor: 'Contrato / Setor legado',
  gestorImediatoAvaliador: 'Gestor texto legado',
  cargoColaborador: 'Analista',
  dataAdmissao: '2026-01-05',
  cargoAvaliador: 'Coordenador',
  relacionamentoNota: 'PLENA',
  comunicacaoNota: 'PARCIAL',
  atitudeNota: 'PLENA',
  saudeSegurancaNota: 'ACIMA DA MÉDIA',
  dominioTecnicoProcessosNota: 'PLENA',
  adaptacaoMudancaNota: 'PLENA',
  autogestaoGestaoPessoasNota: 'PARCIAL',
  comentarioFinal: '-',
  avaliadoEm: '-',
  avaliadoFinalizadoEm: '-',
}, 'PDF de RQ_RH_103 deve aceitar payload antigo, inclusive comentário final vazio')
assert.equal(hasExperienceEvaluationPrintableData(oldPayload), true, 'payload antigo preenchido deve ser imprimível')

const missingFieldsPayload = {
  campos: { colaboradorAvaliado: 'Sem notas completas' },
  avaliacaoGestor: { relacionamentoNota: 'PLENA' },
}
const missingNormalized = normalizeExperienceEvaluationPayload(missingFieldsPayload)
assert.equal(missingNormalized.comunicacaoNota, '-', 'campo de nota ausente normaliza hífen para o PDF')
assert.equal(missingNormalized.comentarioFinal, '-', 'comentário final ausente usa hífen sem quebrar a normalização')
assert.equal(hasExperienceEvaluationPrintableData(missingFieldsPayload), true, 'campos faltantes não bloqueiam quando há ao menos uma nota')
assert.equal(hasExperienceEvaluationPrintableData({ campos: { colaboradorAvaliado: 'Sem avaliação' } }), false, 'sem dados de avaliação deve retornar mensagem clara')

const newPayload = {
  formData: {
    colaboradorAvaliado: 'Payload novo',
    contratoSetor: 'Setor novo',
    gestorImediatoAvaliadorId: 'gestor-1',
  },
  avaliacaoGestor: {
    relacionamentoNota: 'PARCIAL',
  },
}
assert.equal(normalizeExperienceEvaluationPayload(newPayload).gestorImediatoAvaliador, 'gestor-1', 'gestor vinculado como usuário deve ter fallback pelo id')

const detailData = extractExperienceEvaluationData(oldPayload)
assert.equal(detailData.colaboradorAvaliado, normalizeExperienceEvaluationPayload(oldPayload).colaboradorAvaliado, 'detalhe deve usar a mesma normalização do PDF')
assert.equal(
  detailData.notas.find((item) => item.key === 'relacionamentoNota').value,
  normalizeExperienceEvaluationPayload(oldPayload).relacionamentoNota,
  'nota exibida no detalhe deve ser a mesma usada no PDF',
)
assert.ok(
  detailData.notas.find((item) => item.key === 'relacionamentoNota').description.includes('Relaciona-se bem'),
  'detalhe deve exibir descrição padrão para payload antigo sem schema novo',
)

const solicitation = {
  tipoId: 'RQ_RH_103',
  status: 'AGUARDANDO_FINALIZACAO_AVALIACAO',
  solicitanteId: 'solicitante-1',
  payload: oldPayload,
}
const concludedSolicitation = { ...solicitation, status: 'CONCLUIDA' }
const cancelledSolicitation = { ...solicitation, status: 'CANCELADA' }
const baseCtx = {
  userId: 'user-1',
  role: 'USER',
  userDepartmentIds: [],
  userSetorKeys: [],
  finalizerTipoIds: [],
  allowedTipoIds: [],
  viewerTipoIds: [],
  actionableTipoIds: [],
  isExperienceEvaluationCoordinator: false,
  isRhAuthorizedForExperienceEvaluation: false,
  hasSolicitationsModuleAccess: true,
}

assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, solicitation), true, 'PDF permite administrador')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, concludedSolicitation), true, 'PDF de RQ_RH_103 concluída funciona')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, finalizerTipoIds: ['RQ_RH_103'] }, solicitation), true, 'PDF permite finalizador autorizado')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, isRhAuthorizedForExperienceEvaluation: true }, solicitation), true, 'PDF permite RH autorizado')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, isExperienceEvaluationCoordinator: true }, solicitation), true, 'PDF permite coordenador autorizado')
assert.equal(canPrintExperienceEvaluationPdf(baseCtx, solicitation), false, 'PDF bloqueia usuário sem permissão')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, cancelledSolicitation), false, 'PDF bloqueia status cancelado')

const pdfRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-pdf/route.ts', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
assert.match(pdfRoute, /normalizeExperienceEvaluationPayload\(solicitation\.payload,\s*solicitation\)/, 'rota PDF deve usar a normalização compartilhada')
assert.match(pdfRoute, /question\.description/, 'rota PDF deve renderizar descrições das competências')
assert.match(pdfRoute, /<strong>Nota:<\/strong>/, 'rota PDF deve renderizar as notas das competências')
assert.match(pdfRoute, /A avaliação ainda não possui dados suficientes para impressão\./, 'rota PDF deve retornar mensagem clara quando sem avaliação')
assert.match(pdfRoute, /A avaliação cancelada não pode ser impressa\./, 'rota PDF deve bloquear cancelada com mensagem clara')
assert.match(detailModal, /canPrintExperienceEvaluationPdf/, 'detalhe deve consumir a permissão calculada pela API')
assert.match(detailModal, /\/api\/solicitacoes\/\$\{solicitationId\}\/avaliacao-pdf/, 'botão deve chamar a rota correta do PDF')
assert.match(detailModal, /Você pode visualizar este chamado, mas não possui permissão para imprimir a avaliação\./, 'botão desabilitado deve explicar falta de permissão')

console.log('experience-evaluation-pdf-printing ok')
