const assert = require('node:assert/strict')
const { DocumentFlowStepType, DocumentVersionStatus } = require('@prisma/client')
const {
  resolveInitialVersionStatus,
  routingForStatus,
  existingCodeRevisionMessage,
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

test('documento com fluxo configurado sempre inicia em aprovação de gestão', () => {
  const status = resolveInitialVersionStatus([{ stepType: DocumentFlowStepType.QUALITY }])
  const routing = routingForStatus(status)
  assert.equal(status, DocumentVersionStatus.AG_APROVACAO)
  assert.equal(routing.targetPath, '/dashboard/controle-documentos/para-aprovacao')
})


test('documento existente em aprovação informa aba de aprovação', () => {
  const duplicate = evaluateCodeAvailability('DOC-001', DocumentVersionStatus.AG_APROVACAO, 3)
  assert.equal(duplicate.available, true)
  assert.equal(duplicate.isRevision, true)
  assert.equal(duplicate.currentRevisionNumber, 3)
  assert.match(duplicate.message, /próxima revisão/)
  assert.match(duplicate.message, /AG_APROVACAO/)
})

test('documento existente e publicado direciona para aba de publicados', () => {
  const duplicate = evaluateCodeAvailability('DOC-100', DocumentVersionStatus.PUBLICADO, 8)
  assert.equal(duplicate.available, true)
  assert.equal(duplicate.isRevision, true)
  assert.equal(duplicate.routing.targetPath, '/dashboard/controle-documentos/publicados')
})

test('status fora das abas principais cai na listagem de publicação', () => {
  const routing = routingForStatus(DocumentVersionStatus.EM_REVISAO)
  assert.equal(routing.targetPath, '/dashboard/controle-documentos/publicacao')
})

test('registro órfão sem versão não deve bloquear novo envio', () => {
  const orphan = evaluateCodeAvailability('DOC-ORPHAN', null, null)
  assert.equal(orphan.available, true)
  assert.equal(orphan.isRevision, false)
  assert.match(orphan.message, /sem versão ativa/)
})

test('mensagem de duplicidade continua explícita quando existe versão ativa', () => {
  const message = existingCodeRevisionMessage('DOC-200', DocumentVersionStatus.EM_ANALISE_QUALIDADE, 2)
  assert.match(message, /EM_ANALISE_QUALIDADE/)
  assert.match(message, /revisão atual 2/)
})