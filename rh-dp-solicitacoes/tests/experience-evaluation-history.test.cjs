const assert = require('node:assert/strict')

const {
  extractExperienceEvaluationData,
} = require('../src/lib/experienceEvaluationForm')

const parsed = extractExperienceEvaluationData({
  campos: {
    historicoRelacionado: 'Colaborador transferido de setor em 2025.',
  },
})

assert.equal(parsed.historicoRelacionado, 'Colaborador transferido de setor em 2025.')

console.log('experience-evaluation-history ok')