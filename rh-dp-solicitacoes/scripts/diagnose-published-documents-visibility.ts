import { DocumentVersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Reason = 'DOCUMENT_INACTIVE' | 'NO_PUBLICADO_VERSION' | 'ONLY_CANCELADO' | 'ONLY_OBSOLETE' | 'MISSING_FILE_URL' | 'NOT_FOUND'

function parseCodes() {
  const arg = process.argv.find((item) => item.startsWith('--codes='))
  return String(arg?.slice('--codes='.length) ?? '').split(',').map((code) => code.trim()).filter(Boolean)
}

function resolveVisibility(document: any): { appearsInPublishedGrid: boolean; reason?: Reason } {
  if (!document) return { appearsInPublishedGrid: false, reason: 'NOT_FOUND' }
  if (!document.isActive) return { appearsInPublishedGrid: false, reason: 'DOCUMENT_INACTIVE' }
  const versions = document.versions ?? []
  const published = versions.filter((version: any) => version.status === DocumentVersionStatus.PUBLICADO)
  if (!published.length) {
    if (versions.length && versions.every((version: any) => version.status === DocumentVersionStatus.CANCELADO)) return { appearsInPublishedGrid: false, reason: 'ONLY_CANCELADO' }
    if (versions.length && versions.every((version: any) => version.obsoleteAt)) return { appearsInPublishedGrid: false, reason: 'ONLY_OBSOLETE' }
    return { appearsInPublishedGrid: false, reason: 'NO_PUBLICADO_VERSION' }
  }
  if (published.every((version: any) => !version.fileUrl)) return { appearsInPublishedGrid: false, reason: 'MISSING_FILE_URL' }
  return { appearsInPublishedGrid: true }
}

async function main() {
  const codes = parseCodes()
  if (!codes.length) throw new Error('Informe --codes="CODIGO1,CODIGO2"')

  const documents = await prisma.isoDocument.findMany({
    where: { code: { in: codes } },
    select: {
      id: true,
      code: true,
      title: true,
      isActive: true,
      activeCode: true,
      documentType: { select: { id: true, code: true, description: true } },
      ownerCostCenter: { select: { id: true, code: true, description: true } },
      author: { select: { id: true, fullName: true, email: true, login: true } },
      versions: {
        orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, revisionNumber: true, status: true, publishedAt: true, isCurrentPublished: true, fileUrl: true, obsoleteAt: true, operationalUseBlocked: true },
      },
    },
  })
  const byCode = new Map(documents.map((document) => [document.code, document]))
  const diagnostics = codes.map((code) => {
    const document = byCode.get(code) ?? null
    return { code, document, ...resolveVisibility(document) }
  })
  console.dir({ filtersEquivalentToPublishedGrid: { documentIsActive: true, versionStatus: DocumentVersionStatus.PUBLICADO }, diagnostics }, { depth: null })
}

main().catch((error) => {
  console.error('[diagnose-published-documents-visibility] failed', error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
