const assert = require('node:assert/strict')
const fs = require('node:fs')

const {
  isExperienceEvaluationEvaluator,
} = require('../src/lib/experienceEvaluation.shared')

{
  const solicitation = {
    approverId: 'legacy-user-id',
    payload: {
      campos: {
        gestorImediatoAvaliadorId: 'legacy-user-id',
        gestorImediatoAvaliador: 'Katia Ferreira Gonçalves',
      },
    },
  }

  const katia = {
    id: 'new-user-id',
    fullName: 'Kátia Ferreira Gonçalves',
  }

  assert.equal(
    isExperienceEvaluationEvaluator(solicitation, katia),
    true,
    'Quando o nome do avaliador corresponder ao payload, a regra deve liberar mesmo com id legado divergente.',
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
