const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/lib/bi/solicitacoesPessoal.ts', 'utf8')

assert.match(
  source,
  /codigo:\s*\{\s*in:\s*\['RQ\.RH\.001',\s*'RQ\.DP\.001'\]\s*\}/,
  'Filtro BI deve conter somente códigos de Solicitação de Pessoal/Admissão',
)

assert.match(
  source,
  /id:\s*\{\s*in:\s*\['RQ_063',\s*'SOLICITACAO_ADMISSAO'\]\s*\}/,
  'Filtro BI deve manter IDs esperados de Solicitação de Pessoal/Admissão',
)

assert.doesNotMatch(
  source,
  /nome:\s*\{\s*contains:\s*'Solicitação de pessoal'\s*\}/,
  'Filtro BI não deve depender de contains por nome para classificar Solicitação de Pessoal',
)

assert.match(
  source,
  /NOT:\s*\{\s*[\s\S]*RQ_RH_103[\s\S]*RQ\.RH\.103[\s\S]*\}/,
  'Filtro BI deve excluir explicitamente o tipo de Avaliação do Período de Experiência',
)

console.info('bi-solicitacao-pessoal-tipo-filter.test.cjs: ok')