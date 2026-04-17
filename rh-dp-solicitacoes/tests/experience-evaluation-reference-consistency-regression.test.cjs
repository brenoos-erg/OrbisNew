const assert = require('node:assert/strict')
const fs = require('node:fs')

const createRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const managerEvalRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-gestor/route.ts', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
const visibilitySource = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')

assert.match(
  createRoute,
  /payload\.campos\s*=\s*patchExperienceEvaluationEvaluatorFields\(payload\.campos \?\? \{\}, gestorSelecionado\)/,
  'A criação da avaliação deve persistir referência canônica do avaliador no payload.',
)

assert.match(
  managerEvalRoute,
  /isExperienceEvaluationEvaluator\(\s*\{ payload: solicitation\.payload, approverId: solicitation\.approverId \},\s*me,/s,
  'A etapa de avaliação deve usar a mesma regra compartilhada de responsabilidade do frontend.',
)

assert.match(
  detailModal,
  /isExperienceEvaluationEvaluator\(\s*\{ payload: detail\?\.payload, approverId: detail\?\.approverId \},\s*currentUser \?\? \{\},/s,
  'O frontend deve usar a mesma referência de responsabilidade aplicada no backend.',
)

assert.match(
  visibilitySource,
  /OR:\s*\[\{ solicitanteId: input\.userId \}, \{ approverId: input\.userId \}, \.\.\.evaluatorPayloadFilters\]/,
  'A visibilidade de recebidas da avaliação deve incluir solicitante e avaliador responsável.',
)

console.log('✅ experience-evaluation-reference-consistency-regression.test passed')
