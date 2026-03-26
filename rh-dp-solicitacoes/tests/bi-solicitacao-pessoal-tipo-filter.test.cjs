const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/lib/bi/solicitacoesPessoal.ts', 'utf8')

assert.match(
  source,
  /codigo:\s*\{\s*in:\s*\['RQ\.RH\.001',\s*'RQ\.DP\.001'\]\s*\}/,
  'Filtro BI deve conter somente códigos de Solicitação de Pessoal/Admissão',
)

assert.doesNotMatch(
  source,
  /codigo:\s*\{\s*in:\s*\[[^\]]*RQ\.RH\.002/,
  'Filtro BI não deve incluir código da Avaliação do Período de Experiência',
)

assert.match(
  source,
  /id:\s*\{\s*in:\s*\['RQ_063',\s*'SOLICITACAO_ADMISSAO'\]\s*\}/,
  'Filtro BI deve manter IDs esperados de Solicitação de Pessoal/Admissão',
)

console.info('bi-solicitacao-pessoal-tipo-filter.test.cjs: ok')