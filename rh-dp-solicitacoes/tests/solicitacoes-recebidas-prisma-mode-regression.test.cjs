const assert = require('node:assert/strict')
const fs = require('node:fs')

const routeSource = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const queryBuilderSource = fs.readFileSync('src/lib/receivedSolicitationsQuery.ts', 'utf8')

assert.doesNotMatch(
  queryBuilderSource,
  /mode:\s*['"]insensitive['"]/,
  'Builder da rota de recebidas não pode usar mode: insensitive',
)

for (const expected of [
  "{ titulo: { contains: text } }",
  "{ descricao: { contains: text } }",
  "{ payload: { path: '$.campos', string_contains: text } }",
  "{ payload: { path: '$', string_contains: text } }",
  "{ payload: { path: '$.formulario', string_contains: text } }",
  "{ payload: { path: '$.form', string_contains: text } }",
  "{ payload: { path: '$.metadata', string_contains: text } }",
  "{ payload: { path: '$.requestData', string_contains: text } }",
  "{ payload: { path: '$.dynamicForm', string_contains: text } }",
  "{ payload: { path: '$.answers', string_contains: text } }",
  "{ payload: { path: '$.fields', string_contains: text } }",
  "{ payload: { path: '$.avaliacaoGestor', string_contains: text } }",
]) {
  assert.match(queryBuilderSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

assert.match(routeSource, /const \{ findManyArgs, countArgs \} = buildListAndCountArgs\(where, \{/)
assert.match(routeSource, /prisma\.solicitation\.findMany\(findManyArgs\)/)
assert.match(routeSource, /prisma\.solicitation\.count\(countArgs\)/)

console.log('solicitacoes-recebidas-prisma-mode-regression ok')