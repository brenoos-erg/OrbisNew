const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflowsPath = path.join(__dirname, '..', 'data', 'solicitation-workflows.json')
const workflows = JSON.parse(fs.readFileSync(workflowsPath, 'utf8'))
const equipamentoFlow = workflows.find(
  (item) => item.tipoId === 'RQ_089' || item.tipoId === 'SOLICITACAO_EQUIPAMENTO',
)

assert.ok(equipamentoFlow, 'workflow da RQ_089 deve existir')
assert.equal(
  equipamentoFlow.steps.some((step) => step.kind === 'APROVACAO'),
  false,
  'workflow da RQ_089 não deve ter aprovação inicial obrigatória',
)

assert.deepEqual(
  equipamentoFlow.transitions,
  [
    { fromStepKey: 'USUARIO', toStepKey: 'TI' },
    { fromStepKey: 'TI', toStepKey: 'FIM' },
  ],
  'workflow da RQ.089 deve seguir USUARIO -> TI -> FIM',
)

console.info('solicitacao-equipamento-workflow.test.cjs: ok')
