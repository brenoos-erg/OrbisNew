require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const {
  EXPERIENCE_EVALUATION_COMMENT_QUESTION,
  EXPERIENCE_EVALUATION_INTRO_TEXT,
  EXPERIENCE_EVALUATION_QUESTIONS,
  EXPERIENCE_EVALUATION_SCORE_OPTIONS,
} = require('../src/lib/experienceEvaluationQuestions')
const { EXPERIENCE_EVALUATION_REQUIRED_FIELDS } = require('../src/lib/experienceEvaluation.constants')
const { extractExperienceEvaluationData } = require('../src/lib/experienceEvaluationForm')

const expectedQuestions = [
  ['relacionamentoNota', 'RELACIONAMENTO'],
  ['comunicacaoNota', 'COMUNICAÇÃO'],
  ['atitudeNota', 'ATITUDE'],
  ['saudeSegurancaNota', 'SAÚDE E SEGURANÇA'],
  ['dominioTecnicoProcessosNota', 'DOMÍNIO TÉCNICO/ PROCESSOS'],
  ['adaptacaoMudancaNota', 'ADAPTAÇÃO, MOBILIZAÇÃO E GESTÃO DA MUDANÇA'],
  ['autogestaoGestaoPessoasNota', 'AUTOGESTÃO/ GESTÃO DE PESSOAS'],
]

assert.equal(EXPERIENCE_EVALUATION_QUESTIONS.length, 7, 'deve haver 7 competências')
assert.deepEqual(
  EXPERIENCE_EVALUATION_QUESTIONS.map((question) => [question.field, question.title]),
  expectedQuestions,
  'competências devem seguir campos e títulos oficiais',
)
for (const question of EXPERIENCE_EVALUATION_QUESTIONS) {
  assert.ok(question.description.trim().length > 30, `${question.field} deve ter descrição preenchida`)
}
assert.deepEqual(
  [...EXPERIENCE_EVALUATION_SCORE_OPTIONS],
  ['INSUFICIENTE', 'PARCIAL', 'PLENA', 'ACIMA DA MÉDIA'],
  'opções das notas devem ser exatamente as definidas',
)
assert.equal(
  EXPERIENCE_EVALUATION_COMMENT_QUESTION.label,
  '2 - Deseja realizar algum comentário sobre o colaborador em questão?',
  'comentário final deve ter label oficial',
)
assert.deepEqual(
  [...EXPERIENCE_EVALUATION_REQUIRED_FIELDS],
  [...EXPERIENCE_EVALUATION_QUESTIONS.map((question) => question.field), EXPERIENCE_EVALUATION_COMMENT_QUESTION.field],
  'todas as notas e comentário final devem ser obrigatórios',
)

const seed = fs.readFileSync('prisma/seed.ts', 'utf8')
assert.match(seed, /stage: 'avaliacao'/, 'seed deve colocar campos de avaliação na etapa de avaliação')
assert.doesNotMatch(seed, /relacionamentoNota'[\s\S]*?stage: 'solicitante'/, 'campos de avaliação não devem ser stage solicitante')

const openingPage = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')
assert.match(openingPage, /EXPERIENCE_EVALUATION_REQUIRED_FIELDS\.includes/, 'abertura deve filtrar campos de avaliação')

const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
assert.match(detailModal, /EXPERIENCE_EVALUATION_INTRO_TEXT/, 'formulário do gestor deve exibir texto introdutório')
assert.match(detailModal, /EXPERIENCE_EVALUATION_SCORE_OPTIONS/, 'formulário do gestor deve usar opções oficiais')
assert.match(detailModal, /item\.description/, 'detalhe deve renderizar descrição da competência')
assert.match(detailModal, /Nota:/, 'detalhe deve renderizar nota respondida')

const pdfRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-pdf/route.ts', 'utf8')
assert.match(pdfRoute, /EXPERIENCE_EVALUATION_QUESTIONS/, 'PDF deve usar lista padrão de perguntas')
assert.match(pdfRoute, /question\.description/, 'PDF deve renderizar descrição da competência')
assert.match(pdfRoute, /<strong>Nota:<\/strong>/, 'PDF deve renderizar nota respondida')

const legacyPayload = {
  campos: { colaboradorAvaliado: 'Pessoa antiga' },
  avaliacaoGestor: {
    relacionamentoNota: 'PLENA',
    comunicacaoNota: 'PARCIAL',
    atitudeNota: 'INSUFICIENTE',
    saudeSegurancaNota: 'ACIMA DA MÉDIA',
    dominioTecnicoProcessosNota: 'PLENA',
    adaptacaoMudancaNota: 'PARCIAL',
    autogestaoGestaoPessoasNota: 'PLENA',
    comentarioFinal: 'Comentário legado',
  },
}
const detailData = extractExperienceEvaluationData(legacyPayload)
assert.equal(
  detailData.notas.find((item) => item.key === 'relacionamentoNota').description,
  EXPERIENCE_EVALUATION_QUESTIONS[0].description,
  'chamado antigo sem description deve usar descrição padrão',
)
assert.equal(
  detailData.notas.find((item) => item.key === 'relacionamentoNota').value,
  'PLENA',
  'payload antigo com respostas deve continuar aparecendo',
)
assert.equal(detailData.comentarioFinal, 'Comentário legado', 'comentário final legado deve continuar aparecendo')

const route = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-gestor/route.ts', 'utf8')
assert.match(route, /missingFields/, 'API deve validar campos obrigatórios para concluir avaliação')
assert.match(route, /invalidScoreFields/, 'API deve validar opções oficiais de nota')
assert.ok(EXPERIENCE_EVALUATION_INTRO_TEXT.endsWith('Gesto.Com:'), 'texto introdutório deve ser o oficial')

console.log('experience-evaluation-questions ok')
