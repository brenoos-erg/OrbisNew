const assert = require('node:assert/strict')
const { getNadaConstaDefaultFieldsForSetor } = require('../src/lib/solicitationTypes')

const saude = getNadaConstaDefaultFieldsForSetor('SAUDE')
const sst = getNadaConstaDefaultFieldsForSetor('SST')

assert.deepEqual(saude[0]?.options, ['Ciente'])
assert.deepEqual(sst[0]?.options, ['Ciente'])

console.log('nada consta ciente options ok')