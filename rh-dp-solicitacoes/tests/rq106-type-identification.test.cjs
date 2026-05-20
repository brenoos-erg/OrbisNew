const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/lib/solicitationTypes.ts', 'utf8')
assert.match(source, /export function isSolicitacaoExclusaoPlanoDependentes/, 'helper deve existir')
assert.match(source, /id === 'RQ_106'/, 'deve identificar por id RQ_106')
assert.match(source, /id === 'RQ_RH_106'/, 'deve identificar por id RQ_RH_106')
assert.match(source, /codigo\.includes\('RQ\.106'\)/, 'deve identificar por código RQ.106')
assert.match(source, /codigo\.includes\('RQ_106'\)/, 'deve identificar por código RQ_106')
assert.match(source, /nome\.includes\('EXCLUSAO'\)[\s\S]*nome\.includes\('PLANO'\)[\s\S]*nome\.includes\('DEPENDENTE'\)/, 'deve identificar por nome normalizado')

console.info('rq106-type-identification.test.cjs: ok')
