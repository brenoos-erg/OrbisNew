const assert = require('node:assert/strict')
const { DocumentFlowStepType, DocumentVersionStatus } = require('@prisma/client')
const {
  resolveInitialVersionStatus,
  routingForStatus,
  duplicateCodeMessage,
  evaluateCodeAvailability,
} = require('../src/lib/iso-document-routing')

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('novo documento sem fluxo inicia como PUBLICADO', () => {
  const status = resolveInitialVersionStatus([])
  assert.equal(status, DocumentVersionStatus.PUBLICADO)
})

test('documento em fluxo de qualidade aponta para aba correta', () => {
  const status = resolveInitialVersionStatus([{ stepType: DocumentFlowStepType.QUALITY }])
  const routing = routingForStatus(status)
  assert.equal(status, DocumentVersionStatus.EM_ANALISE_QUALIDADE)
  assert.equal(routing.targetPath, '/dashboard/controle-documentos/em-analise-qualidade')
})

test('documento existente em aprovação informa aba de aprovação', () => {
  const duplicate = evaluateCodeAvailability('DOC-001', DocumentVersionStatus.AG_APROVACAO)
  assert.equal(duplicate.available, false)
  assert.match(duplicate.message, /para-aprovacao/)
  assert.match(duplicate.message, /AG_APROVACAO/)
})

test('documento existente e publicado direciona para aba de publicados', () => {
  const duplicate = evaluateCodeAvailability('DOC-100', DocumentVersionStatus.PUBLICADO)
  assert.equal(duplicate.available, false)
  assert.equal(duplicate.routing.targetPath, '/dashboard/controle-documentos/publicados')
})

test('status fora das abas principais cai na listagem de publicação', () => {
  const routing = routingForStatus(DocumentVersionStatus.EM_REVISAO)
  assert.equal(routing.targetPath, '/dashboard/controle-documentos/publicacao')
})

test('registro órfão sem versão não deve bloquear novo envio', () => {
  const orphan = evaluateCodeAvailability('DOC-ORPHAN', null)
  assert.equal(orphan.available, true)
  assert.match(orphan.message, /sem versão ativa/)
})

test('mensagem de duplicidade continua explícita quando existe versão ativa', () => {
  const message = duplicateCodeMessage('DOC-200', DocumentVersionStatus.EM_ANALISE_QUALIDADE)
  assert.match(message, /EM_ANALISE_QUALIDADE/)
  assert.match(message, /em-analise-qualidade/)
})