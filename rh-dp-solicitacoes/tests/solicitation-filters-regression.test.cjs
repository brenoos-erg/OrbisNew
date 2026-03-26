const assert = require('node:assert/strict')
const fs = require('node:fs')

const sentApi = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const receivedApi = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')

for (const apiSource of [sentApi, receivedApi]) {
  assert.match(apiSource, /buildUtcDateRangeFilter/)
  assert.match(apiSource, /path:\s*\['formulario'\]/)
  assert.match(apiSource, /path:\s*\['form'\]/)
  assert.match(apiSource, /path:\s*\['dynamicForm'\]/)
  assert.match(apiSource, /path:\s*\['answers'\]/)
}

console.log('solicitation-filters-regression ok')