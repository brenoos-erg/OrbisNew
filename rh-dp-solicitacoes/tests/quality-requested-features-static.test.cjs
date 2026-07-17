const assert = require('node:assert/strict')
const fs = require('node:fs')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const publishedRoute = read('src/app/api/documents/published/route.ts')
const isoDocuments = read('src/lib/iso-documents.ts')
const cancelledRoute = read('src/app/api/documents/cancelled/route.ts')
const tabs = read('src/components/documents/DocumentControlTabs.tsx')
const accessHelper = read('src/lib/documents/documentManagementAccess.ts')
const cancelRoute = read('src/app/api/documents/versions/[versionId]/cancel/route.ts')
const deleteRoute = read('src/app/api/documents/[id]/route.ts')
const originalRoute = read('src/app/api/documents/versions/[versionId]/original/route.ts')
const viewerPage = read('src/app/documents/view/[versionId]/page.tsx')
const cargoModal = read('src/app/dashboard/rh/cargos/CargoFormModal.tsx')
const planAction = read('src/app/dashboard/sst/planos-de-acao/[planId]/acoes/[actionId]/AcaoPlanoAvulsoDetailClient.tsx')
const planDetail = read('src/app/dashboard/sst/planos-de-acao/[planId]/PlanoAvulsoDetailClient.tsx')
const controlledRoute = read('src/app/api/documents/versions/[versionId]/controlled/route.ts')
const controlledPipeline = read('src/lib/documents/controlledPdfPipeline.ts')

// Documentos publicados: somente versões PUBLICADO de documentos ativos.
assert.match(publishedRoute, /DocumentVersionStatus\.PUBLICADO/)
assert.match(publishedRoute, /buildVersionWhere\(parsed\.filters\)/)
assert.match(isoDocuments, /status:\s*filters\.status/)
assert.match(isoDocuments, /isActive:\s*true/)
assert.match(isoDocuments, /normalizeDocumentCodeSearch/)

// Área separada de cancelados.
assert.match(cancelledRoute, /DocumentVersionStatus\.CANCELADO/)
assert.match(cancelledRoute, /fetchGrid\(/)
assert.match(tabs, /controle-documentos\/cancelados/)
assert.match(tabs, /Documentos Cancelados/)

// Cancelar e excluir somente por gestor autorizado da Qualidade.
assert.match(accessHelper, /ModuleLevel\.NIVEL_3/)
assert.match(accessHelper, /isQualityDepartment/)
assert.match(accessHelper, /DOCUMENT_QUALITY_MANAGER_EMAILS/)
assert.match(cancelRoute, /requireQualityDocumentManager\(me\.id\)/)
assert.match(deleteRoute, /requireQualityDocumentManager\(me\.id\)/)
assert.match(cancelRoute, /prisma\.\$transaction/)
assert.match(cancelRoute, /documentAuditLog\.create/)
assert.match(cancelRoute, /operationalUseBlocked:\s*true/)
assert.match(deleteRoute, /documentAuditLog\.create/)

// Download do original exclusivo para a Qualidade, com auditoria.
assert.match(originalRoute, /requireQualityDocumentManager\(me\.id\)/)
assert.match(originalRoute, /registerDocumentAuditLog/)
assert.match(originalRoute, /X-Document-Copy-Type': 'ORIGINAL'/)
assert.match(viewerPage, /qualityAccess\.canManage/)
assert.match(viewerPage, /Baixar documento original/)

// Cadastro de cargos: rolagem, metadados importados e campos longos.
assert.match(cargoModal, /overflow-y-auto/)
assert.match(cargoModal, /if \(extracted\.indexador\) setIndexador/)
assert.match(cargoModal, /if \(extracted\.revision\) setRevision/)
assert.match(cargoModal, /if \(extracted\.documentDate\) setDocumentDate/)
assert.match(cargoModal, /Descrição detalhada/)
assert.match(cargoModal, /Principais atividades/)
assert.match(cargoModal, /Atividades complementares/)

// Planos de ação avulsos: evidências visíveis e editáveis.
assert.match(planAction, /setActiveTab\('evidencias'\)/)
assert.match(planAction, /Evidências textuais da ação/)
assert.match(planAction, /Salvar evidências/)
assert.match(planAction, /evidencias,/)
assert.match(planDetail, /tab === 'evidencias'/)
assert.match(planDetail, /EvidenceList/)

// Pipeline de PDF controlado: validação, diagnóstico e erro padronizado.
assert.match(controlledRoute, /DOCUMENT_FINAL_PDF_PREPARE_FAILED/)
assert.match(controlledRoute, /ControlledPdfPipelineError/)
assert.match(controlledPipeline, /FILE_NOT_FOUND/)
assert.match(controlledPipeline, /CONVERSION_FAILED/)
assert.match(controlledPipeline, /INTERMEDIATE_PDF_INVALID/)
assert.match(controlledPipeline, /FINAL_PDF_INVALID/)
assert.match(controlledPipeline, /validatePdf\(finalPdfBuffer\)/)

console.log('quality-requested-features-static ok')
