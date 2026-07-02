const assert = require('node:assert/strict')
const { DocumentFlowStepType, DocumentVersionStatus, ModuleLevel } = require('@prisma/client')
const {
  resolveInitialVersionStatus,
  routingForStatus,
  existingCodeRevisionMessage,
  evaluateCodeAvailability,
  postingErrorDeletedCodeMessage,
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

test('documento controlado sem fluxo bloqueia publicação direta', () => {
  assert.throws(
    () => resolveInitialVersionStatus([], { documentTypeControlledCopy: true }),
    /Tipo documental sem fluxo de aprovação configurado/,
  )
})

test('publicação direta sem fluxo exige NIVEL_3 e justificativa', () => {
  const status = resolveInitialVersionStatus([], {
    documentTypeControlledCopy: true,
    userModuleLevel: ModuleLevel.NIVEL_3,
    directPublicationJustification: 'Migração controlada autorizada.',
  })
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

test('código novo não inicia fluxo de revisão automática', () => {
  const available = evaluateCodeAvailability('RQ.ENG.196', null, null)
  assert.equal(available.available, true)
  assert.equal(available.isRevision, false)
  assert.equal(available.currentRevisionNumber, null)
})

test('documento cancelado formalmente mantém regra de nova revisão', () => {
  const canceled = evaluateCodeAvailability('RQ.ENG.196', DocumentVersionStatus.CANCELADO, 0)
  assert.equal(canceled.available, true)
  assert.equal(canceled.isRevision, true)
  assert.equal(canceled.currentRevisionNumber, 0)
  assert.match(canceled.message, /Último status: CANCELADO/)
})

test('exclusão por erro de postagem tem mensagem própria de código liberado', () => {
  assert.match(postingErrorDeletedCodeMessage(), /Código disponível para novo cadastro/)
  assert.match(postingErrorDeletedCodeMessage(), /excluído por erro de postagem/)
})
