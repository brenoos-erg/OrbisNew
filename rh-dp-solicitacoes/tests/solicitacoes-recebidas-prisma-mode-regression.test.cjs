const assert = require('node:assert/strict')
const fs = require('node:fs')

const routeSource = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const queryBuilderSource = fs.readFileSync('src/lib/receivedSolicitationsQuery.ts', 'utf8')

assert.doesNotMatch(
  queryBuilderSource,
  /string_contains\s*:/,
  'Builder de recebidas não pode usar string_contains em JSON no provider atual.',
)

assert.doesNotMatch(
  queryBuilderSource,
  /\{\s*titulo:\s*\{\s*contains\s*:/,
  'Builder de recebidas não pode usar contains diretamente no Prisma where global.',
)

assert.match(queryBuilderSource, /export function flattenSearchableText\(value: unknown\): string/)
assert.match(queryBuilderSource, /export function normalizeSearchText\(value: string\): string/)
assert.match(queryBuilderSource, /where\.protocolo\s*=\s*\{\s*startsWith:\s*protocolo\s*\}/)

assert.match(routeSource, /const globalSearchText = getGlobalTextSearch\(searchParams\)/)
assert.match(routeSource, /includeGlobalSearchData:\s*Boolean\(globalSearchText\)/)
assert.match(routeSource, /const filteredSolicitations = !globalSearchText/)
assert.match(routeSource, /buildSolicitationSearchText\(s as unknown as Record<string, unknown>\)/)
assert.match(routeSource, /const total = globalSearchText \? filteredSolicitations\.length : dbTotal/)

console.log('solicitacoes-recebidas-prisma-mode-regression ok')
