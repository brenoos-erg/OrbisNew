const assert = require('node:assert/strict')
const fs = require('node:fs')

const pageSource = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')

assert.doesNotMatch(
  pageSource,
  /if \(!String\(extras\.previstoContrato \?\? ''\)\.trim\(\)\)/,
  'RQ_063 não deve bloquear abertura inicial sem previstoContrato.',
)
assert.doesNotMatch(
  pageSource,
  /Preencha o campo obrigatório "Previsto em contrato/,
  'RQ_063 não deve exibir erro de obrigatório para previstoContrato na abertura inicial.',
)

const getFieldWindow = (field) => {
  const index = pageSource.indexOf(`value={extras.${field} ?? ''}`)
  assert.notEqual(index, -1, `${field} deve continuar disponível para complemento do RH.`)
  const before = pageSource.lastIndexOf('<div', index)
  const after = pageSource.indexOf('</div>', index)
  return pageSource.slice(before, after)
}

const previstoField = getFieldWindow('previstoContrato')
assert.doesNotMatch(previstoField, /\brequired\b/, 'previstoContrato deve ser opcional na abertura inicial.')
assert.match(pageSource, /Campo opcional na abertura/, 'Tela deve orientar que RH poderá complementar previstoContrato depois.')

for (const field of ['nomeProfissional', 'dataAdmissao', 'observacoesRh']) {
  const fieldBlock = getFieldWindow(field)
  assert.doesNotMatch(fieldBlock, /\brequired\b/, `${field} não deve ser obrigatório na abertura inicial.`)
}

console.log('✅ rq063-rh-fields-initial-submission.test passed')
