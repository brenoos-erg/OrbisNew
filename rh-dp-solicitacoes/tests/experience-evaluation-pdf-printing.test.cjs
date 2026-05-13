require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {
  hasExperienceEvaluationPrintableData,
  normalizeExperienceEvaluationPayload,
} = require('../src/lib/experienceEvaluation.shared')
const { extractExperienceEvaluationData } = require('../src/lib/experienceEvaluationForm')
const { canPrintExperienceEvaluationPdf, canViewSolicitation } = require('../src/lib/solicitationAccessPolicy')
const {
  buildExperienceEvaluationPdfFilename,
  toExperienceEvaluationPdfDisplayValue,
  URGENT_EXPERIENCE_EVALUATION_PROTOCOLS,
} = require('../src/lib/pdf/experienceEvaluationPdf')

const urgentProtocols = [
  'RQ2026-00203',
  'RQ2026-00210',
  'RQ2026-00657',
  'RQ2026-00755',
  'RQ2026-00763',
  'RQ2026-00764',
  'RQ2026-00800',
]

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
    avaliadoEm: '2026-04-13T12:00:00.000Z',
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
  comentarioFinal: '',
  avaliadoEm: '2026-04-13T12:00:00.000Z',
}, 'normalizeExperienceEvaluationPayload aceita payload antigo, inclusive comentário final vazio')
assert.equal(hasExperienceEvaluationPrintableData(oldPayload), true, 'payload antigo preenchido deve ser imprimível')

const jsonPayload = JSON.stringify({
  formulario: { colaboradorAvaliado: 'Payload JSON' },
  avaliacao: { relacionamentoNota: 'PLENA', avaliadoEm: '2026-05-01' },
})
assert.equal(normalizeExperienceEvaluationPayload(jsonPayload).colaboradorAvaliado, 'Payload JSON', 'normalização deve aceitar payload string JSON')
assert.equal(normalizeExperienceEvaluationPayload(jsonPayload).relacionamentoNota, 'PLENA', 'normalização deve ler payload.avaliacao')
assert.deepEqual(normalizeExperienceEvaluationPayload(null), {
  colaboradorAvaliado: '',
  contratoSetor: '',
  gestorImediatoAvaliador: '',
  cargoColaborador: '',
  dataAdmissao: '',
  cargoAvaliador: '',
  relacionamentoNota: '',
  comunicacaoNota: '',
  atitudeNota: '',
  saudeSegurancaNota: '',
  dominioTecnicoProcessosNota: '',
  adaptacaoMudancaNota: '',
  autogestaoGestaoPessoasNota: '',
  comentarioFinal: '',
  avaliadoEm: '',
}, 'normalização deve aceitar payload null sem quebrar')

const missingFieldsPayload = {
  campos: { colaboradorAvaliado: 'Sem notas completas' },
  respostas: { notas: [{ key: 'relacionamentoNota', value: 'PLENA' }] },
}
const missingNormalized = normalizeExperienceEvaluationPayload(missingFieldsPayload)
assert.equal(missingNormalized.comunicacaoNota, '', 'campo de nota ausente normaliza vazio para o PDF exibir hífen')
assert.equal(missingNormalized.comentarioFinal, '', 'comentário final ausente não quebra a normalização')
assert.equal(toExperienceEvaluationPdfDisplayValue(missingNormalized.comunicacaoNota), '-', 'campo ausente vira hífen no PDF')
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

const solicitation = {
  tipoId: 'RQ_RH_103',
  tipo: { id: 'RQ_RH_103', codigo: 'RQ.RH.103', nome: 'Avaliação do período de experiência' },
  status: 'AGUARDANDO_FINALIZACAO_AVALIACAO',
  solicitanteId: 'solicitante-1',
  payload: oldPayload,
}
const concludedSolicitation = { ...solicitation, status: 'CONCLUIDA' }
const finalizedSolicitation = { ...solicitation, status: 'FINALIZADA' }
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
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, concludedSolicitation), true, 'PDF permite status CONCLUIDA')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, finalizedSolicitation), true, 'PDF permite status FINALIZADA')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, solicitation), true, 'PDF permite AGUARDANDO_FINALIZACAO_AVALIACAO')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, finalizerTipoIds: ['RQ_RH_103'] }, concludedSolicitation), true, 'PDF permite finalizador autorizado sem exigir canFinalize')
assert.equal(canViewSolicitation({ ...baseCtx, finalizerTipoIds: ['RQ_RH_103'] }, concludedSolicitation), true, 'finalizador autorizado mantém visibilidade em chamada concluída')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, isRhAuthorizedForExperienceEvaluation: true }, solicitation), true, 'PDF permite RH autorizado')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, isExperienceEvaluationCoordinator: true }, solicitation), true, 'PDF permite coordenador autorizado')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, viewerTipoIds: ['RQ_RH_103'] }, concludedSolicitation), true, 'visualizador autorizado consegue imprimir se pode visualizar o tipo')
assert.equal(canViewSolicitation(baseCtx, concludedSolicitation), false, 'usuário sem visibilidade não visualiza RQ_RH_103 concluída')
assert.equal(canPrintExperienceEvaluationPdf(baseCtx, concludedSolicitation), false, 'usuário sem permissão recebe bloqueio/403')
assert.equal(canPrintExperienceEvaluationPdf({ ...baseCtx, role: 'ADMIN' }, cancelledSolicitation), false, 'PDF bloqueia CANCELADA')

const pdfRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-pdf/route.ts', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
const exportScript = fs.readFileSync('scripts/export-experience-evaluation-pdfs.ts', 'utf8')
const packageJson = fs.readFileSync('package.json', 'utf8')
assert.match(pdfRoute, /normalizeExperienceEvaluationPayload\(solicitation\.payload\)/, 'rota PDF deve usar a normalização compartilhada')
assert.match(pdfRoute, /Esta avaliação foi cancelada e não pode ser impressa\./, 'rota PDF deve bloquear cancelada com mensagem clara')
assert.match(pdfRoute, /A avaliação ainda não possui dados suficientes para impressão\./, 'rota PDF deve retornar mensagem clara quando sem avaliação')
assert.match(pdfRoute, /Content-Disposition': `inline; filename="\$\{buildExperienceEvaluationPdfFilename\(solicitation\.protocolo\)\}"`/, 'rota PDF deve retornar Content-Disposition inline com filename padrão')
assert.doesNotMatch(pdfRoute, /canFinalizeSolicitation|canEditSolicitation|canApproveSolicitation|canAssumeSolicitation/, 'rota PDF não deve depender de permissão operacional')
assert.match(detailModal, /canPrintExperienceEvaluationPdf/, 'detalhe deve consumir a permissão calculada pela API')
assert.match(detailModal, /Imprimir avaliação/, 'botão deve se chamar Imprimir avaliação')
assert.match(detailModal, /\/api\/solicitacoes\/\$\{solicitationId\}\/avaliacao-pdf/, 'botão deve chamar a rota correta do PDF')
assert.match(detailModal, /isAvaliacaoExperiencia && effectiveStatus !== 'CANCELADA'/, 'botão deve aparecer para RQ_RH_103 finalizada/concluída quando a API permitir')
assert.match(exportScript, /URGENT_EXPERIENCE_EVALUATION_PROTOCOLS/, 'script deve diagnosticar protocolos urgentes pela lista padrão')
assert.match(packageJson, /avaliacoes:export-pdfs/, 'package.json deve expor script de exportação')
assert.deepEqual([...URGENT_EXPERIENCE_EVALUATION_PROTOCOLS], urgentProtocols, 'lista urgente deve estar disponível para diagnóstico/exportação')
assert.equal(buildExperienceEvaluationPdfFilename('RQ2026-00203'), 'avaliacao-periodo-experiencia-RQ2026-00203.pdf', 'nome do PDF deve seguir padrão solicitado')

console.log('experience-evaluation-pdf-printing ok')
