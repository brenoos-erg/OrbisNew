const assert = require('node:assert/strict')
const fs = require('node:fs')

const sentApi = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const receivedApi = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')

assert.match(sentApi, /buildUtcDateRangeFilter/)

assert.match(sentApi, /path:\s*(\['formulario'\]|'\$\.formulario')/)
assert.match(sentApi, /path:\s*(\['form'\]|'\$\.form')/)
assert.match(sentApi, /path:\s*(\['dynamicForm'\]|'\$\.dynamicForm')/)
assert.match(sentApi, /path:\s*(\['answers'\]|'\$\.answers')/)

assert.doesNotMatch(
  sentApi,
  /mode:\s*['"]insensitive['"]/,
  'API geral de solicitações não deve usar mode: insensitive (incompatível com provider mysql)',
)

assert.doesNotMatch(
  receivedApi,
  /mode:\s*['"]insensitive['"]/,
  'API de recebidas não deve usar mode: insensitive (incompatível com provider mysql)',
)

assert.match(sentApi, /where\.protocolo = \{\s*\n\s*contains: protocolo,\s*\n\s*\}/)
assert.match(sentApi, /fullName: \{ contains: solicitante \}/)
assert.match(sentApi, /email: \{ contains: solicitante \}/)
assert.match(sentApi, /solicitanteFilters\.login = \{ contains: solicitanteLogin \}/)
assert.match(sentApi, /titulo: \{ contains: textValue \}/)
assert.match(sentApi, /descricao: \{ contains: textValue \}/)
assert.match(sentApi, /prisma\.solicitation\.findMany\(\{\s*\n\s*where,/)
assert.match(sentApi, /prisma\.solicitation\.count\(\{ where \}\)/)

console.log('solicitation-filters-regression ok')
