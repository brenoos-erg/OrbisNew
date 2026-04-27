const assert = require('node:assert/strict')
const fs = require('node:fs')

const receivedPageSource = fs.readFileSync('src/app/dashboard/solicitacoes/recebidas/page.tsx', 'utf8')
const sentPageSource = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/page.tsx', 'utf8')

assert.match(
  receivedPageSource,
  /<SolicitationStatusBadge status=\{row\.status\} \/>/,
  'Solicitações recebidas devem renderizar badge reutilizável de status na tabela.',
)

assert.match(
  receivedPageSource,
  /getStatusPresentation\(row\.status\)\.label/,
  'Exportação de recebidas deve continuar com texto simples do status.',
)

assert.match(
  sentPageSource,
  /getStatusPresentation\(r\.status\)\.label/,
  'Exportação de enviadas deve usar texto simples amigável de status.',
)

assert.doesNotMatch(
  receivedPageSource,
  /function mapStatusLabel\(/,
  'Mapeamento visual antigo com emoji não deve mais existir na tela de recebidas.',
)

assert.match(
  receivedPageSource,
  /params\.set\('status', filters\.status\)/,
  'Filtro técnico de status deve continuar na busca backend.',
)

assert.match(
  receivedPageSource,
  /handleSort\('status'\)/,
  'Ordenação da coluna de status deve continuar funcionando.',
)

console.log('solicitacoes-recebidas-status-badge-regression.test.cjs: ok')
