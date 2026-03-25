const assert = require('node:assert/strict')
const {
  extractExperienceEvaluationData,
  isExperienceEvaluationTipo,
} = require('../src/lib/experienceEvaluationForm')

{
  const payload = {
    campos: {
      colaboradorAvaliado: 'Maria',
      cargoColaborador: 'Analista',
      contratoSetor: 'CLT / RH',
      gestorImediatoAvaliador: 'João',
      cargoAvaliador: 'Coordenador',
    },
    avaliacaoGestor: {
      relacionamentoNota: 'PARCIAL',
      comunicacaoNota: 'PLENA',
      comentarioFinal: 'Bom desempenho.',
    },
  }
  const result = extractExperienceEvaluationData(payload)
  assert.equal(result.colaboradorAvaliado, 'Maria')
  assert.equal(result.gestorImediatoAvaliador, 'João')
  assert.equal(result.notas.find((item) => item.key === 'relacionamentoNota')?.value, 'PARCIAL')
  assert.equal(result.comentarioFinal, 'Bom desempenho.')
}

{
  const payload = {
    form: {
      colaboradorAvaliado: 'Carlos',
      relacionamentoNota: 'INSUFICIENTE',
      comentarioFinal: 'Necessita acompanhamento.',
    },
  }
  const result = extractExperienceEvaluationData(payload)
  assert.equal(result.colaboradorAvaliado, 'Carlos')
  assert.equal(result.notas.find((item) => item.key === 'relacionamentoNota')?.value, 'INSUFICIENTE')
}

assert.equal(isExperienceEvaluationTipo({ id: 'RQ_RH_103', nome: '' }), true)
assert.equal(isExperienceEvaluationTipo({ codigo: 'RQ.RH.103', nome: '' }), true)
assert.equal(isExperienceEvaluationTipo({ nome: 'Avaliação do Período de Experiência' }), true)
assert.equal(isExperienceEvaluationTipo({ nome: 'Outro tipo' }), false)

console.log('✅ experience-evaluation-form.test passed')