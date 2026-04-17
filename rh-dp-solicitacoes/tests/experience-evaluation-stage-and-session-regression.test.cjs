const assert = require('node:assert/strict')
const fs = require('node:fs')

const avaliacaoRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/[id]/avaliacao-gestor/route.ts',
  'utf8',
)
const recebidasRouteSource = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')

assert.match(
  avaliacaoRouteSource,
  /isExperienceEvaluationEvaluator\(\s*\{\s*payload: solicitation\.payload, approverId: solicitation\.approverId \},\s*me,\s*\)/s,
  'A etapa da avaliação do gestor deve ser liberada pelo mesmo vínculo de responsabilidade aplicado no backend.',
)
assert.match(
  avaliacaoRouteSource,
  /status: EXPERIENCE_EVALUATION_FINALIZATION_STATUS/,
  'Ao concluir a avaliação, o fluxo deve avançar para finalização de avaliação no RH.',
)

assert.match(
  recebidasRouteSource,
  /if \(err instanceof Error && err\.message === 'Usuário não autenticado'\)\s*\{\s*return NextResponse\.json\(\{ error: err\.message \}, \{ status: 401 \}\)/s,
  'Sessão inválida na listagem de recebidas deve responder 401 explícito, evitando falso erro genérico.',
)

console.log('experience-evaluation-stage-and-session-regression ok')
