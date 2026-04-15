const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')

for (const expectedPath of [
  '$.campos.gestorImediatoAvaliadorId',
  '$.metadata.gestorImediatoAvaliadorId',
  '$.requestData.gestorImediatoAvaliadorId',
  '$.dynamicForm.gestorImediatoAvaliadorId',
  '$.campos.avaliadorId',
  '$.metadata.avaliadorId',
  '$.requestData.avaliadorId',
  '$.dynamicForm.avaliadorId',
  '$.campos.gestorId',
  '$.metadata.gestorId',
  '$.requestData.gestorId',
  '$.dynamicForm.gestorId',
  '$.campos.gestorImediatoAvaliadorLogin',
  '$.metadata.gestorImediatoAvaliadorLogin',
  '$.requestData.gestorImediatoAvaliadorLogin',
  '$.dynamicForm.gestorImediatoAvaliadorLogin',
  '$.campos.avaliadorLogin',
  '$.metadata.avaliadorLogin',
  '$.requestData.avaliadorLogin',
  '$.dynamicForm.avaliadorLogin',
  '$.campos.gestorLogin',
  '$.metadata.gestorLogin',
  '$.requestData.gestorLogin',
  '$.dynamicForm.gestorLogin',
  '$.campos.gestorImediatoAvaliadorEmail',
  '$.metadata.gestorImediatoAvaliadorEmail',
  '$.requestData.gestorImediatoAvaliadorEmail',
  '$.dynamicForm.gestorImediatoAvaliadorEmail',
  '$.campos.avaliadorEmail',
  '$.metadata.avaliadorEmail',
  '$.requestData.avaliadorEmail',
  '$.dynamicForm.avaliadorEmail',
  '$.campos.gestorEmail',
  '$.metadata.gestorEmail',
  '$.requestData.gestorEmail',
  '$.dynamicForm.gestorEmail',
  '$.campos.gestorImediatoAvaliador',
  '$.metadata.gestorImediatoAvaliador',
  '$.requestData.gestorImediatoAvaliador',
  '$.dynamicForm.gestorImediatoAvaliador',
  '$.campos.avaliador',
  '$.metadata.avaliador',
  '$.requestData.avaliador',
  '$.dynamicForm.avaliador',
  '$.campos.gestor',
  '$.metadata.gestor',
  '$.requestData.gestor',
  '$.dynamicForm.gestor',
]) {
  assert.ok(
    source.includes(expectedPath),
    `Filtro ausente para o caminho do payload: ${expectedPath}`,
  )
}

assert.match(source, /tipoId:\s*EXPERIENCE_EVALUATION_TIPO_ID/)
assert.match(source, /status:\s*EXPERIENCE_EVALUATION_STATUS/)
assert.match(source, /buildExperienceEvaluatorPayloadFilters\(input\)/)

console.log('✅ experience-evaluation-visibility-regression.test passed')