import fs from 'node:fs/promises'
import path from 'node:path'
import { DocumentVersionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolvePublicDocumentPath } from '@/lib/documents/documentStorage'
import { isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'
import { validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'

type HealthStatus = 'OK' | 'WARN' | 'ERROR'
type Reason =
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_INACTIVE'
  | 'NO_PUBLICADO_VERSION'
  | 'NO_CURRENT_PUBLISHED_VERSION'
  | 'MULTIPLE_CURRENT_PUBLISHED_VERSIONS'
  | 'PUBLISHED_VERSION_WITHOUT_FILE_URL'
  | 'FILE_NOT_FOUND'
  | 'PDF_INVALID'
  | 'CONTROLLED_PDF_PREPARE_FAILED'
  | 'ONLY_CANCELADO'
  | 'ONLY_OBSOLETE'
  | 'GRID_VISIBILITY_MISMATCH'
  | 'OK'

type AuditRow = {
  code: string
  title: string | null
  documentId: string | null
  isActive: boolean | null
  revisionNumber: number | null
  versionId: string | null
  status: string | null
  isCurrentPublished: boolean | null
  fileUrl: string | null
  fileExists: boolean | null
  pdfValid: boolean | null
  appearsInPublishedGrid: boolean
  healthStatus: HealthStatus
  reason: Reason
}

function parseCodes() {
  const arg = process.argv.find((item) => item.startsWith('--codes='))
  return String(arg?.slice('--codes='.length) ?? '').split(',').map((code) => code.trim()).filter(Boolean)
}

function parseArgs() {
  const codes = parseCodes()
  const all = process.argv.includes('--all')
  if (!all && !codes.length) throw new Error('Informe --all ou --codes="CODIGO1,CODIGO2"')
  if (all && codes.length) throw new Error('Use apenas um modo: --all ou --codes')
  return { all, codes }
}

function isOnlyCancelado(versions: any[]) {
  return versions.length > 0 && versions.every((version) => version.status === DocumentVersionStatus.CANCELADO)
}

function isOnlyObsolete(versions: any[]) {
  return versions.length > 0 && versions.every((version) => version.obsoleteAt)
}

function resolveGridVisibility(document: any, publishedVersions: any[]) {
  return Boolean(document?.isActive && publishedVersions.length > 0)
}

function pickPrimaryVersion(currentPublished: any[], publishedVersions: any[]) {
  return currentPublished[0] ?? publishedVersions[0] ?? null
}

async function auditDocument(code: string, document: any | null): Promise<AuditRow> {
  if (!document) {
    return { code, title: null, documentId: null, isActive: null, revisionNumber: null, versionId: null, status: null, isCurrentPublished: null, fileUrl: null, fileExists: null, pdfValid: null, appearsInPublishedGrid: false, healthStatus: 'ERROR', reason: 'DOCUMENT_NOT_FOUND' }
  }

  const versions = document.versions ?? []
  const publishedVersions = versions.filter((version: any) => version.status === DocumentVersionStatus.PUBLICADO)
  const currentPublished = publishedVersions.filter((version: any) => version.isCurrentPublished)
  const version = pickPrimaryVersion(currentPublished, publishedVersions)
  const appearsInPublishedGrid = resolveGridVisibility(document, publishedVersions)

  let fileExists: boolean | null = null
  let pdfValid: boolean | null = null
  let reason: Reason = 'OK'
  let healthStatus: HealthStatus = 'OK'

  if (!document.isActive) {
    reason = 'DOCUMENT_INACTIVE'
    healthStatus = 'ERROR'
  } else if (!publishedVersions.length) {
    reason = isOnlyCancelado(versions) ? 'ONLY_CANCELADO' : isOnlyObsolete(versions) ? 'ONLY_OBSOLETE' : 'NO_PUBLICADO_VERSION'
    healthStatus = 'ERROR'
  } else if (!appearsInPublishedGrid) {
    reason = 'GRID_VISIBILITY_MISMATCH'
    healthStatus = 'ERROR'
  } else if (!currentPublished.length) {
    reason = 'NO_CURRENT_PUBLISHED_VERSION'
    healthStatus = 'ERROR'
  } else if (currentPublished.length > 1) {
    reason = 'MULTIPLE_CURRENT_PUBLISHED_VERSIONS'
    healthStatus = 'WARN'
  }

  if (version && healthStatus !== 'ERROR') {
    if (!version.fileUrl) {
      reason = 'PUBLISHED_VERSION_WITHOUT_FILE_URL'
      healthStatus = 'ERROR'
    } else {
      const resolvedPath = await resolvePublicDocumentPath(version.fileUrl)
      fileExists = resolvedPath.exists
      if (!resolvedPath.exists) {
        reason = 'FILE_NOT_FOUND'
        healthStatus = 'ERROR'
      } else {
        const buffer = await fs.readFile(resolvedPath.absolutePath)
        const fileType = resolveDocumentFileType(version.fileUrl)
        const looksPdf = fileType.isPdf || isPdfBuffer(buffer)
        if (looksPdf) {
          const validation = validatePdfBuffer(buffer)
          pdfValid = validation.valid
          if (!validation.valid) {
            reason = 'PDF_INVALID'
            healthStatus = 'ERROR'
          }
        }

        const familyRule = resolveDocumentFamilyRule(document.code)
        if (healthStatus === 'OK' && familyRule.family === 'controlled-pdf' && looksPdf && pdfValid !== true) {
          reason = 'CONTROLLED_PDF_PREPARE_FAILED'
          healthStatus = 'WARN'
        }
      }
    }
  }

  return {
    code: document.code,
    title: document.title,
    documentId: document.id,
    isActive: document.isActive,
    revisionNumber: version?.revisionNumber ?? null,
    versionId: version?.id ?? null,
    status: version?.status ?? null,
    isCurrentPublished: version?.isCurrentPublished ?? null,
    fileUrl: version?.fileUrl ?? null,
    fileExists,
    pdfValid,
    appearsInPublishedGrid,
    healthStatus,
    reason,
  }
}

async function loadDocuments(all: boolean, codes: string[]) {
  return prisma.isoDocument.findMany({
    where: all
      ? { OR: [{ isActive: true }, { versions: { some: { status: DocumentVersionStatus.PUBLICADO } } }] }
      : { code: { in: codes } },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      title: true,
      isActive: true,
      versions: {
        orderBy: [{ isCurrentPublished: 'desc' }, { revisionNumber: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, revisionNumber: true, status: true, publishedAt: true, isCurrentPublished: true, fileUrl: true, obsoleteAt: true, operationalUseBlocked: true },
      },
    },
  })
}

async function writeReports(rows: AuditRow[]) {
  await fs.mkdir('logs', { recursive: true })
  const errorsByReason = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.healthStatus !== 'OK') acc[row.reason] = (acc[row.reason] ?? 0) + 1
    return acc
  }, {})
  const errorDocuments = rows.filter((row) => row.healthStatus === 'ERROR').map((row) => `${row.code} - ${row.reason}`)
  const summary = [
    `totalDocumentsChecked=${rows.length}`,
    `totalOk=${rows.filter((row) => row.healthStatus === 'OK').length}`,
    `totalWarn=${rows.filter((row) => row.healthStatus === 'WARN').length}`,
    `totalError=${rows.filter((row) => row.healthStatus === 'ERROR').length}`,
    `errorsByReason=${JSON.stringify(errorsByReason)}`,
    'documentsWithError:',
    ...errorDocuments.map((item) => `- ${item}`),
  ].join('\n')
  await fs.writeFile(path.join('logs', 'document-health-audit.json'), JSON.stringify(rows, null, 2))
  await fs.writeFile(path.join('logs', 'document-health-audit-summary.txt'), `${summary}\n`)
}

async function main() {
  const { all, codes } = parseArgs()
  const documents = await loadDocuments(all, codes)
  const byCode = new Map(documents.map((document) => [document.code, document]))
  const targets = all ? documents.map((document) => document.code) : codes
  const rows = await Promise.all(targets.map((code) => auditDocument(code, byCode.get(code) ?? null)))
  console.table(rows)
  await writeReports(rows)
}

main().catch((error) => {
  console.error('[audit-published-documents-health] failed', error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
