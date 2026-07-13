import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'
import {
  resolvePrivateDocumentPublishedPath,
  resolvePublicDocumentPath,
} from '../src/lib/documents/documentStorage'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const confirm = args.includes('--confirm')
const outputArg = args.find((arg) => arg.startsWith('--output='))
const operatorArg = args.find((arg) => arg.startsWith('--operator-id='))
const operatorId = operatorArg?.split('=')[1]?.trim() || null
const output = outputArg?.split('=')[1] ?? path.join(process.cwd(), 'storage', 'reports', 'current-published-versions-audit.json')

type VersionCandidate = {
  id: string
  status: string
  isCurrentPublished: boolean
  operationalUseBlocked: boolean
  publishedStorageKey: string | null
  publishedFileUrl: string | null
  publishedAt: Date | null
  revisionNumber: number
}

type Finding = {
  documentId: string
  code: string
  type: string
  versionId?: string | null
  versionIds?: string[]
  validCandidateIds?: string[]
  details?: Record<string, unknown>
}

async function publishedFileExists(version: VersionCandidate) {
  try {
    if (version.publishedStorageKey) {
      await resolvePrivateDocumentPublishedPath(version.publishedStorageKey)
      return true
    }
    if (version.publishedFileUrl) {
      const resolved = await resolvePublicDocumentPath(version.publishedFileUrl)
      return resolved.exists
    }
  } catch {
    return false
  }
  return false
}

async function isValidPublishedCandidate(version: VersionCandidate) {
  return version.status === 'PUBLICADO'
    && !version.operationalUseBlocked
    && await publishedFileExists(version)
}

async function inspectDocuments() {
  const documents = await prisma.isoDocument.findMany({
    include: {
      versions: {
        orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          status: true,
          isCurrentPublished: true,
          operationalUseBlocked: true,
          publishedStorageKey: true,
          publishedFileUrl: true,
          publishedAt: true,
          revisionNumber: true,
        },
      },
      currentPublishedVersion: {
        select: {
          id: true,
          status: true,
          isCurrentPublished: true,
          operationalUseBlocked: true,
          publishedStorageKey: true,
          publishedFileUrl: true,
          publishedAt: true,
          revisionNumber: true,
        },
      },
    },
  })

  const findings: Finding[] = []
  const candidatesByDocument = new Map<string, VersionCandidate[]>()

  for (const document of documents) {
    const currentFlags = document.versions.filter((version) => version.isCurrentPublished)
    const validCandidates: VersionCandidate[] = []
    for (const version of document.versions) {
      if (await isValidPublishedCandidate(version)) validCandidates.push(version)
    }
    candidatesByDocument.set(document.id, validCandidates)

    if (currentFlags.length > 1) {
      findings.push({
        documentId: document.id,
        code: document.code,
        type: 'MULTIPLE_CURRENT_PUBLISHED_VERSIONS',
        versionIds: currentFlags.map((version) => version.id),
        validCandidateIds: validCandidates.map((version) => version.id),
      })
    }

    if (!document.currentPublishedVersionId && currentFlags.length > 0) {
      findings.push({
        documentId: document.id,
        code: document.code,
        type: 'MISSING_CURRENT_PUBLISHED_VERSION_ID',
        versionIds: currentFlags.map((version) => version.id),
        validCandidateIds: validCandidates.map((version) => version.id),
      })
    }

    if (document.currentPublishedVersionId && !document.currentPublishedVersion) {
      findings.push({
        documentId: document.id,
        code: document.code,
        type: 'BROKEN_CURRENT_PUBLISHED_REFERENCE',
        versionId: document.currentPublishedVersionId,
        validCandidateIds: validCandidates.map((version) => version.id),
      })
    }

    if (document.currentPublishedVersion && !(await isValidPublishedCandidate(document.currentPublishedVersion))) {
      findings.push({
        documentId: document.id,
        code: document.code,
        type: 'INVALID_CURRENT_REFERENCE',
        versionId: document.currentPublishedVersion.id,
        validCandidateIds: validCandidates.map((version) => version.id),
      })
    }

    if (document.currentPublishedVersion && !document.currentPublishedVersion.isCurrentPublished) {
      findings.push({
        documentId: document.id,
        code: document.code,
        type: 'CURRENT_POINTER_FLAG_MISMATCH',
        versionId: document.currentPublishedVersion.id,
        validCandidateIds: validCandidates.map((version) => version.id),
      })
    }
  }

  return { documents, findings, candidatesByDocument }
}

async function main() {
  if (apply && !confirm) throw new Error('Use --apply --confirm para corrigir referências vigentes.')
  if (apply && !operatorId) throw new Error('Use --operator-id=<id> para identificar o responsável pela correção.')

  if (apply) {
    const operator = await prisma.user.findUnique({
      where: { id: operatorId! },
      select: { id: true, status: true },
    })
    if (!operator || operator.status !== 'ATIVO') throw new Error('Operador não encontrado ou inativo.')
  }

  const before = await inspectDocuments()
  const actions: Array<Record<string, unknown>> = []
  const manualReview: Array<Record<string, unknown>> = []

  if (apply) {
    const affectedDocumentIds = [...new Set(before.findings.map((finding) => finding.documentId))]
    for (const documentId of affectedDocumentIds) {
      const document = before.documents.find((item) => item.id === documentId)
      const validCandidates = before.candidatesByDocument.get(documentId) ?? []
      if (!document) continue

      if (validCandidates.length !== 1) {
        manualReview.push({
          documentId,
          code: document.code,
          reason: validCandidates.length === 0 ? 'NO_VALID_PUBLISHED_CANDIDATE' : 'MULTIPLE_VALID_PUBLISHED_CANDIDATES',
          validCandidateIds: validCandidates.map((version) => version.id),
        })
        continue
      }

      const keep = validCandidates[0]
      await prisma.$transaction(async (tx) => {
        const demoted = await tx.documentVersion.updateMany({
          where: { documentId, id: { not: keep.id }, isCurrentPublished: true },
          data: { isCurrentPublished: false, status: 'OBSOLETO', operationalUseBlocked: true },
        })
        await tx.documentVersion.update({
          where: { id: keep.id },
          data: { isCurrentPublished: true, operationalUseBlocked: false },
        })
        await tx.isoDocument.update({
          where: { id: documentId },
          data: { currentPublishedVersionId: keep.id },
        })
        await tx.documentAuditLog.create({
          data: {
            documentId,
            versionId: keep.id,
            userId: operatorId!,
            action: 'OBSOLETE',
            reason: 'Correção administrativa de referência da versão vigente após auditoria.',
            metadata: {
              script: 'audit-current-published-versions',
              demotedCount: demoted.count,
              selectedVersionId: keep.id,
              apply,
              confirm,
            },
          },
        })
        actions.push({ documentId, code: document.code, keptVersionId: keep.id, demotedCount: demoted.count })
      })
    }
  }

  const after = await inspectDocuments()
  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    confirm,
    operatorId,
    before: before.findings,
    actions,
    manualReview,
    after: after.findings,
    ok: after.findings.length === 0 && manualReview.length === 0,
  }

  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    ok: report.ok,
    output,
    beforeFindings: before.findings.length,
    actions: actions.length,
    manualReview: manualReview.length,
    afterFindings: after.findings.length,
  }, null, 2))
  if (!report.ok) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
