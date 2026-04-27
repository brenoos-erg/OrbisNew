const fs = require('fs')
const assert = require('assert')

const tiposRouteSource = fs.readFileSync('src/app/api/tipos-solicitacao/route.ts', 'utf8')
const externalAdmissionRouteSource = fs.readFileSync('src/app/api/solicitacoes/externas/admissao/route.ts', 'utf8')
const externalAdmissionPublicRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/externas/admissao/public/[token]/route.ts',
  'utf8',
)
const seedSource = fs.readFileSync('prisma/seed.ts', 'utf8')

assert.match(
  tiposRouteSource,
  /tipoCodigo === EXTERNAL_ADMISSION_TYPE_CODE \|\| tipoId === EXTERNAL_ADMISSION_TYPE_ID/,
  'Listagem comum de tipos deve bloquear o tipo técnico por código e por ID.',
)
assert.match(
  tiposRouteSource,
  /if \(isTechnicalExternalAdmissionType\) return false/,
  'Listagem comum de tipos deve remover explicitamente o tipo técnico de admissão externa.',
)

assert.match(
  externalAdmissionRouteSource,
  /where: \{ id: EXTERNAL_ADMISSION_TYPE_ID \}/,
  'Fluxo externo deve continuar garantindo a existência do tipo técnico por ID fixo.',
)
assert.match(
  externalAdmissionRouteSource,
  /tipoId: EXTERNAL_ADMISSION_TYPE_ID/,
  'Fluxo externo deve continuar criando solicitações usando o tipo técnico de admissão externa.',
)

assert.match(
  externalAdmissionPublicRouteSource,
  /tipoId: EXTERNAL_ADMISSION_TYPE_ID/,
  'Checklist público por token deve continuar resolvendo solicitações do tipo técnico correto.',
)
assert.match(
  externalAdmissionPublicRouteSource,
  /canConclude: isAllRequiredChecklistDone\(checklistStatus\)/,
  'Checklist público deve continuar calculando conclusão com base nos itens obrigatórios.',
)

assert.match(
  seedSource,
  /internalOnly: true,\s*\n\s*hiddenFromCreate: true,\s*\n\s*hiddenFromManualOpening: true,/,
  'Seed deve marcar o tipo técnico de admissão externa como interno/oculto da abertura manual.',
)

console.log('✅ external-admission-type-visibility.test passed')
