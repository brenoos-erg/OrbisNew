import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import {
  PRIVATE_DOCUMENT_SOURCE_ROOT,
  buildStoredDocumentFileName,
  normalizePrivateDocumentStorageKey,
  resolvePrivateDocumentSourcePath,
  validatePrivateSourceFile,
} from '../src/lib/documents/documentStorage'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const reportFile = args.find((arg) => arg.startsWith('--report-file='))?.split('=')[1]
  ?? path.join(process.cwd(), 'reports', `document-source-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)

async function sha256(filePath: string) {
  const buffer = await fs.readFile(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function legacyPublicPath(reference: string) {
  const normalized = String(reference).replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) throw new Error('INVALID_REFERENCE')
  return path.join(process.cwd(), 'public', normalized)
}

async function writeReport(payload: unknown) {
  await fs.mkdir(path.dirname(reportFile), { recursive: true })
  await fs.writeFile(reportFile, JSON.stringify(payload, null, 2))
}

function inferMimeFromExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.xls') return 'application/vnd.ms-excel'
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

async function main() {
  await fs.mkdir(PRIVATE_DOCUMENT_SOURCE_ROOT, { recursive: true })
  const versions = await prisma.documentVersion.findMany({
    where: { sourceStorageKey: null, sourceFileUrl: { not: null } },
    select: { id: true, documentId: true, sourceFileUrl: true, revisionNumber: true, document: { select: { code: true } } },
  })

  const report: any[] = []
  for (const version of versions) {
    const sourceFileUrl = version.sourceFileUrl || ''
    const item: any = { versionId: version.id, documentId: version.documentId, code: version.document.code, sourceFileUrl, status: 'PENDING' }
    let tempPath: string | null = null
    let targetPath: string | null = null
    let dbUpdated = false
    const before = {
      sourceStorageKey: null as string | null,
      sourceOriginalName: null as string | null,
      sourceMimeType: null as string | null,
      sourceSizeBytes: null as bigint | number | null,
      sourceSha256: null as string | null,
    }
    try {
      const sourcePath = legacyPublicPath(sourceFileUrl)
      const buffer = await fs.readFile(sourcePath)
      const sourceStat = await fs.stat(sourcePath)
      const sourceHash = await sha256(sourcePath)
      const validation = validatePrivateSourceFile({ originalName: path.basename(sourcePath), mimeType: inferMimeFromExtension(sourcePath), buffer })
      const targetKey = normalizePrivateDocumentStorageKey(buildStoredDocumentFileName(validation.extension, 'doc'))
      targetPath = path.join(PRIVATE_DOCUMENT_SOURCE_ROOT, targetKey)
      tempPath = `${targetPath}.tmp`
      item.sourcePath = sourcePath
      item.sourceSize = sourceStat.size
      item.sourceHash = sourceHash
      item.targetStorageKey = targetKey

      if (!apply) {
        item.status = 'DRY_RUN'
      } else {
        const current = await prisma.documentVersion.findUnique({
          where: { id: version.id },
          select: { sourceStorageKey: true, sourceOriginalName: true, sourceMimeType: true, sourceSizeBytes: true, sourceSha256: true },
        })
        Object.assign(before, current)
        await fs.writeFile(tempPath, buffer)
        const targetHash = await sha256(tempPath)
        const targetStat = await fs.stat(tempPath)
        if (targetStat.size !== sourceStat.size || targetHash !== sourceHash) throw new Error('HASH_OR_SIZE_MISMATCH')
        await fs.rename(tempPath, targetPath)
        tempPath = null
        const resolvedBeforeDb = await resolvePrivateDocumentSourcePath(targetKey)
        const preDbReadHash = await sha256(resolvedBeforeDb.absolutePath)
        const preDbReadStat = await fs.stat(resolvedBeforeDb.absolutePath)
        if (preDbReadStat.size !== sourceStat.size || preDbReadHash !== sourceHash) throw new Error('PRIVATE_READ_BEFORE_DB_UPDATE_FAILED')
        await prisma.documentVersion.update({
          where: { id: version.id },
          data: {
            sourceStorageKey: targetKey,
            sourceOriginalName: path.basename(sourcePath),
            sourceMimeType: validation.mimeType,
            sourceSizeBytes: validation.sizeBytes,
            sourceSha256: validation.sha256,
          },
        })
        dbUpdated = true
        const resolvedAfterDb = await resolvePrivateDocumentSourcePath(targetKey)
        const privateReadHash = await sha256(resolvedAfterDb.absolutePath)
        const privateReadStat = await fs.stat(resolvedAfterDb.absolutePath)
        if (privateReadStat.size !== sourceStat.size || privateReadHash !== sourceHash) throw new Error('PRIVATE_READ_AFTER_DB_UPDATE_FAILED')
        item.privateReadValidated = true
        await writeReport({ apply, reportFile, partial: true, report: [...report, { ...item, status: 'DB_UPDATED_PRIVATE_VALIDATED_BEFORE_PUBLIC_REMOVAL' }] })
        await fs.rm(sourcePath, { force: true })
        item.publicFileRemoved = true
        item.status = 'MIGRATED_AND_PUBLIC_REMOVED'
        item.manualRollback = { restorePublicPath: sourcePath, privateStorageKey: targetKey, sourceHash, note: 'Rollback manual: copiar o arquivo privado de volta para restorePublicPath e restaurar sourceFileUrl/sourceStorageKey a partir de backup/relatório.' }
      }
    } catch (error) {
      if (tempPath) await fs.rm(tempPath, { force: true }).catch(() => undefined)
      if (dbUpdated) {
        await prisma.documentVersion.update({ where: { id: version.id }, data: before }).catch((rollbackError) => {
          item.rollbackError = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        })
        if (!item.rollbackError && targetPath && item.status !== 'MIGRATED_AND_PUBLIC_REMOVED') await fs.rm(targetPath, { force: true }).catch(() => undefined)
      } else if (targetPath && item.status !== 'MIGRATED_AND_PUBLIC_REMOVED') {
        await fs.rm(targetPath, { force: true }).catch(() => undefined)
      }
      item.status = 'ERROR'
      item.error = error instanceof Error ? error.message : String(error)
    }
    report.push(item)
  }

  const payload = { apply, reportFile, rollbackPlan: 'MANUAL_USING_REPORT_AND_DATABASE_BACKUP', total: report.length, report }
  await writeReport(payload)
  console.log(JSON.stringify(payload, null, 2))
}

main().finally(() => prisma.$disconnect())
