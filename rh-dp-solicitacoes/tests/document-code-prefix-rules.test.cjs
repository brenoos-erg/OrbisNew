const assert = require('node:assert/strict')
const {
  resolveDocumentCodePrefixFromTypeCode,
  enforceDocumentCodePrefix,
  codeMatchesRequiredPrefix,
} = require('../src/lib/documents/documentCodePrefix')

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('usa prefixo base padrão para tipos simples', () => {
  assert.equal(resolveDocumentCodePrefixFromTypeCode('DOCEXT'), 'DOCEXT.')
  assert.equal(resolveDocumentCodePrefixFromTypeCode('PG'), 'PG.')
})

test('preserva padrão específico quando tipo já possui subprefixo', () => {
  assert.equal(resolveDocumentCodePrefixFromTypeCode('PG.QUA'), 'PG.QUA.')
  assert.equal(resolveDocumentCodePrefixFromTypeCode('DOCEXT.QUA.'), 'DOCEXT.QUA.')
})

test('força o código a respeitar o prefixo obrigatório', () => {
  assert.equal(enforceDocumentCodePrefix('teste', 'DOCEXT.'), 'DOCEXT.teste'.toUpperCase())
  assert.equal(enforceDocumentCodePrefix('PG.QUA.001', 'PG.QUA.'), 'PG.QUA.001')
})

test('detecta incompatibilidade de prefixo entre tipo e código', () => {
  assert.equal(codeMatchesRequiredPrefix('DOCEXT.001', 'DOCEXT.'), true)
  assert.equal(codeMatchesRequiredPrefix('teste', 'DOCEXT.'), false)
})