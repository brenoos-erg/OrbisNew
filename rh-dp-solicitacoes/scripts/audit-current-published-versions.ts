import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const confirm = args.includes('--confirm')
const outputArg = args.find((arg) => arg.startsWith('--output='))
const output = outputArg?.split('=')[1] ?? path.join(process.cwd(), 'storage', 'reports', 'current-published-versions-audit.json')

async function main() {
  if (apply && !confirm) throw new Error('Use --apply --confirm para corrigir referências vigentes.')
  const documents = await prisma.isoDocument.findMany({ include: { versions: { where: { isCurrentPublished: true }, orderBy: { publishedAt: 'desc' } }, currentPublishedVersion: true } })
  const findings: any[] = []
  const actions: any[] = []
  for (const document of documents) {
    if (document.versions.length > 1) findings.push({ documentId: document.id, code: document.code, type: 'MULTIPLE_CURRENT_PUBLISHED_VERSIONS', versionIds: document.versions.map((item) => item.id), suggestedCurrentVersionId: document.versions[0]?.id })
    if (!document.currentPublishedVersionId && document.versions.length === 1) findings.push({ documentId: document.id, code: document.code, type: 'MISSING_CURRENT_PUBLISHED_VERSION_ID', versionId: document.versions[0].id })
    if (document.currentPublishedVersion && (!document.currentPublishedVersion.publishedStorageKey || document.currentPublishedVersion.status !== 'PUBLICADO' || document.currentPublishedVersion.operationalUseBlocked)) findings.push({ documentId: document.id, code: document.code, type: 'INVALID_CURRENT_REFERENCE', versionId: document.currentPublishedVersion.id })
    if (apply && document.versions.length >= 1) {
      const keep = document.versions[0]
      await prisma.$transaction(async (tx) => {
        const demoted = await tx.documentVersion.updateMany({ where: { documentId: document.id, id: { not: keep.id }, isCurrentPublished: true }, data: { isCurrentPublished: false, status: 'OBSOLETO', operationalUseBlocked: true } })
        await tx.isoDocument.update({ where: { id: document.id }, data: { currentPublishedVersionId: keep.id } })
        await tx.documentAuditLog.create({ data: { documentId: document.id, versionId: keep.id, action: 'OBSOLETE', reason: 'Correção administrativa de versão vigente após auditoria.', metadata: { script: 'audit-current-published-versions', demotedCount: demoted.count, apply, confirm } } })
        actions.push({ documentId: document.id, keptVersionId: keep.id, demotedCount: demoted.count })
      })
    }
  }
  const report = { generatedAt: new Date().toISOString(), apply, confirm, findings, actions, ok: findings.length === 0 || (apply && actions.length > 0) }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ ok: report.ok, output, findings: findings.length, actions: actions.length }, null, 2))
  if (findings.length > 0 && !apply) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
