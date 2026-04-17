const assert = require('node:assert/strict')
const fs = require('node:fs')

const evaluatorSource = fs.readFileSync('src/lib/experienceEvaluation.shared.ts', 'utf8')

{
  assert.match(
    evaluatorSource,
    /normalize\(assigned\.fullName\) === userFullName/,
    'Quando o nome do avaliador corresponder ao payload, a regra deve liberar mesmo com id legado divergente.',
  )
}

{
  assert.match(
    evaluatorSource,
    /readString\(merged, 'gestorImediatoAvaliadorId'\)\s*\|\|\s*readString\(merged, 'avaliadorId'\)\s*\|\|\s*readString\(merged, 'gestorId'\)/,
    'Campos dedicados vazios devem cair no fallback avaliador/gestor para manter visibilidade.',
  )
}

{
  const source = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')

  assert.match(
    source,
    /tipoId:\s*EXPERIENCE_EVALUATION_TIPO_ID,\s*[\s\S]*status:\s*EXPERIENCE_EVALUATION_STATUS,\s*[\s\S]*OR:\s*\[\{ solicitanteId: input\.userId \}, \{ approverId: input\.userId \}/,
    'A visibilidade de recebidas da avaliação deve incluir o próprio solicitante.',
  )
}

console.log('experience-evaluation-responsibility-regression ok')
