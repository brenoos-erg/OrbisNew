import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const ALLOWLISTS = {
  DocumentVersion_status: ['EM_ELABORACAO', 'EM_REVISAO', 'EM_ANALISE_QUALIDADE', 'AG_APROVACAO', 'AGUARDANDO_PUBLICACAO', 'PUBLICADO', 'PUBLICANDO', 'CANCELADO', 'OBSOLETO', 'VENCIDO'],
  DocumentAuditLog_action: ['VIEW', 'DOWNLOAD', 'SOURCE_FILE_VIEWED', 'SOURCE_FILE_DOWNLOADED', 'SOURCE_FILE_INTEGRITY_FAILED', 'PUBLISHED_FILE_INTEGRITY_FAILED', 'PRINT', 'TECHNICAL_APPROVED', 'TECHNICAL_REJECTED', 'QUALITY_APPROVED', 'QUALITY_REJECTED', 'PUBLISHED', 'CANCEL', 'DIRECT_PUBLICATION', 'SEGREGATION_EXCEPTION_REQUESTED', 'SEGREGATION_EXCEPTION_APPROVED', 'SEGREGATION_EXCEPTION_REJECTED', 'OBSOLETE', 'CONTROLLED_COPY_ISSUED', 'CONTROLLED_COPY_CANCELED'],
  DocumentNotificationLog_event: ['DOCUMENT_CREATED', 'DOCUMENT_SUBMITTED_FOR_APPROVAL', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED', 'DOCUMENT_QUALITY_REVIEW', 'DOCUMENT_AWAITING_PUBLICATION', 'SEGREGATION_EXCEPTION_REQUESTED', 'SEGREGATION_EXCEPTION_APPROVED', 'SEGREGATION_EXCEPTION_REJECTED', 'DOCUMENT_PUBLISHED', 'DOCUMENT_REVISED', 'DOCUMENT_DISTRIBUTED', 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED'],
  DocumentNotificationRule_event: ['DOCUMENT_CREATED', 'DOCUMENT_SUBMITTED_FOR_APPROVAL', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED', 'DOCUMENT_QUALITY_REVIEW', 'DOCUMENT_AWAITING_PUBLICATION', 'SEGREGATION_EXCEPTION_REQUESTED', 'SEGREGATION_EXCEPTION_APPROVED', 'SEGREGATION_EXCEPTION_REJECTED', 'DOCUMENT_PUBLISHED', 'DOCUMENT_REVISED', 'DOCUMENT_DISTRIBUTED', 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED'],
} as const

async function distinct(table: string, column: string) {
  return prisma.$queryRawUnsafe<Array<{ value: string | null }>>(`SELECT DISTINCT \`${column}\` AS value FROM \`${table}\``)
}

function incompatible(values: Array<{ value: string | null }>, allowlist: readonly string[]) {
  return values.map((item) => item.value).filter((value): value is string => typeof value === 'string' && !allowlist.includes(value))
}

async function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='))
  const output = outputArg?.split('=')[1] ?? path.join(process.cwd(), 'storage', 'reports', 'document-enum-preflight.json')
  const values = {
    DocumentVersion_status: await distinct('DocumentVersion', 'status'),
    DocumentAuditLog_action: await distinct('DocumentAuditLog', 'action'),
    DocumentNotificationLog_event: await distinct('DocumentNotificationLog', 'event'),
    DocumentNotificationRule_event: await distinct('DocumentNotificationRule', 'event'),
  }
  const incompatibleValues = Object.fromEntries(Object.entries(values).map(([key, rows]) => [key, incompatible(rows, ALLOWLISTS[key as keyof typeof ALLOWLISTS])]))
  const ok = Object.values(incompatibleValues).every((items) => items.length === 0)
  const report = { ok, generatedAt: new Date().toISOString(), allowlists: ALLOWLISTS, values, incompatibleValues }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ ok, output, incompatibleValues }, null, 2))
  if (!ok) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
