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
const fs = require('node:fs')
const path = require('node:path')

{
  const seedContent = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8')
  const hasCamposNoUpsert = /where:\s*\{\s*id:\s*'RQ_RH_103'\s*\}[\s\S]*schemaJson:\s*avaliacaoExperienciaSchema/.test(seedContent)
  assert.equal(hasCamposNoUpsert, true)

  const requiredFields = [
    'colaboradorAvaliado',
    'cargo',
    'setor',
    'dataAdmissao',
    'periodoAvaliacao',
    'gestorAvaliador',
    'observacoesIniciais',
    'relacionamentoNota',
    'comunicacaoNota',
    'atitudeNota',
    'saudeSegurancaNota',
    'dominioTecnicoProcessosNota',
    'adaptacaoMudancaNota',
    'autogestaoGestaoPessoasNota',
    'comentarioFinal',
  ]
  for (const field of requiredFields) {
    assert.equal(seedContent.includes(`name: '${field}'`) || seedContent.includes(`'${field}'`), true, `Campo ausente no seed: ${field}`)
  }
}

{
  const seedContent = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8')
  const pageContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'dashboard', 'solicitacoes', 'enviadas', 'nova', 'page.tsx'), 'utf8')

  const creationFields = ['colaboradorAvaliado','cargo','setor','dataAdmissao','periodoAvaliacao','gestorAvaliador','observacoesIniciais']
  for (const field of creationFields) {
    assert.equal(seedContent.includes(`name: '${field}'`) && seedContent.includes(`stage: 'solicitante'`), true, `Campo de abertura sem stage solicitante: ${field}`)
  }

  const managerFields = [
    'relacionamentoNota','comunicacaoNota','atitudeNota','saudeSegurancaNota',
    'dominioTecnicoProcessosNota','adaptacaoMudancaNota','autogestaoGestaoPessoasNota','comentarioFinal',
  ]
  for (const field of managerFields) {
    assert.equal(seedContent.includes(`name: '${field}'`) && (seedContent.includes(`stage: 'gestor'`) || seedContent.includes(`stage: 'avaliador'`)), true, `Campo de avaliação sem stage gestor/avaliador: ${field}`)
  }

  assert.equal(pageContent.includes("EXPERIENCE_EVALUATION_CREATION_FIELDS"), false)
  assert.equal(pageContent.includes("isManagerEvaluationField"), false)
}
