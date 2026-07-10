const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/app/dashboard/sst/planos-de-acao/[planId]/PlanoAvulsoDetailClient.tsx', 'utf8')

assert.match(source, /async function cancelPlan\(\)/, 'deve existir função cancelPlan')
assert.match(source, /onClick=\{cancelPlan\}/, 'botão Cancelar plano deve chamar cancelPlan')
assert.match(source, /window\.(confirm|prompt)\(/, 'cancelamento deve pedir confirmação ou justificativa')
assert.doesNotMatch(source, /onClick=\{\(\) => savePlan\('CANCELADO'\)\}/, 'botão não deve cancelar diretamente via savePlan')

console.log('quality action plan cancel confirmation static ok')
