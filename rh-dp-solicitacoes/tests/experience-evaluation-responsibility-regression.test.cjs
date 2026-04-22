const assert = require('node:assert/strict')
const fs = require('node:fs')

const evaluatorSource = fs.readFileSync('src/lib/experienceEvaluation.shared.ts', 'utf8')

{
  assert.match(
    evaluatorSource,
    /const canonicalApproverId = String\(solicitation\.approverId \?\? ''\)\.trim\(\)/,
    'A responsabilidade canônica deve usar approverId quando definido.',
  )
}

{
  assert.match(
    evaluatorSource,
    /readAnyString\(merged, \['gestorImediatoAvaliadorId', 'avaliadorId', 'gestorId'\]\)/,
    'Campos dedicados vazios devem cair no fallback avaliador/gestor para manter visibilidade.',
  )
}

{
  assert.match(
    evaluatorSource,
    /export function patchExperienceEvaluationEvaluatorPayload\(/,
    'A normalização estrutural deve manter id\/nome\/login\/email sincronizados entre frontend e backend.',
  )
}

{
  assert.match(
    evaluatorSource,
    /if \(canonicalApproverId\) \{\s*return Boolean\(userId\) && canonicalApproverId === userId/s,
    'Com approverId definido, a checagem não deve aceitar payload legado divergente.',
  )
}

{
  const source = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')

  assert.match(
    source,
    /tipoId:\s*EXPERIENCE_EVALUATION_TIPO_ID,\s*[\s\S]*status:\s*EXPERIENCE_EVALUATION_STATUS,\s*[\s\S]*\{ OR: \[\{ approverId: null \}, \{ approverId: '' \}\] \}/,
    'A visibilidade de recebidas da avaliação deve incluir o próprio solicitante.',
  )
}

{
  const detailSource = fs.readFileSync('src/app/api/solicitacoes/[id]/route.ts', 'utf8')

  assert.match(
    detailSource,
    /resolveExperienceEvaluationEvaluatorFromDirectory\(payload,\s*experienceEvaluators\)/,
    'A API de detalhes deve resolver o avaliador pela estrutura completa do payload.',
  )

  assert.match(
    detailSource,
    /patchExperienceEvaluationEvaluatorPayload\(payload,\s*resolvedEvaluator\)/,
    'A API de detalhes deve devolver payload da avaliação com referência canônica de responsabilidade sincronizada.',
  )
}

console.log('experience-evaluation-responsibility-regression ok')
