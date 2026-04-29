const assert = require('node:assert/strict')
const fs = require('node:fs')

const sensitiveVisibility = fs.readFileSync('src/lib/sensitiveHiringRequests.ts', 'utf8')
const recebidasRoute = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const countsRoute = fs.readFileSync('src/app/api/solicitacoes/counts/route.ts', 'utf8')
const receivedQuery = fs.readFileSync('src/lib/receivedSolicitationsQuery.ts', 'utf8')

assert.match(
  sensitiveVisibility,
  /const allowedTipoIds = \(input\.allowedTipoIds \?\? \[]\)\.filter\(Boolean\)/,
  'Visibilidade sensível deve considerar tipos permitidos do usuário para preservar acesso VIEWER por tipo.',
)

assert.match(
  sensitiveVisibility,
  /participantFilters\.push\(\{ tipoId: \{ in: allowedTipoIds \} \}\)/,
  'Solicitações sensíveis devem permanecer visíveis quando o tipo estiver em allowedTipoIds.',
)

assert.match(
  recebidasRoute,
  /allowedTipoIds: userAccess\.allowedTipoIds/,
  'API de recebidas deve repassar allowedTipoIds para o filtro sensível.',
)

assert.match(
  countsRoute,
  /allowedTipoIds: userAccess\.allowedTipoIds/,
  'Contadores de recebidas devem usar a mesma regra de visibilidade por tipo.',
)

assert.match(
  receivedQuery,
  /\{ protocolo: \{ contains: text \} \}/,
  'Filtro de texto em recebidas deve buscar também por protocolo.',
)

assert.match(
  receivedQuery,
  /\{ tipo: \{ nome: \{ contains: text \} \} \}/,
  'Filtro de texto em recebidas deve buscar por nome do tipo.',
)

assert.match(
  receivedQuery,
  /\{ tipo: \{ codigo: \{ contains: text \} \} \}/,
  'Filtro de texto em recebidas deve buscar por código do tipo.',
)

console.log('✅ viewer-recebidas-sensitive-visibility-regression.test passed')
