import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, parseGridParams } from '@/lib/iso-documents'
import { prisma } from '@/lib/prisma'
import {
  buildDocumentsExportFilename,
  buildExcelFriendlyCsv,
  buildPublishedDocumentRows,
  buildPublishedDocumentsXlsx,
  DOCUMENT_PUBLISHED_HEADERS,
} from '@/lib/documents/exportDocuments'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const { filters } = parseGridParams(req.nextUrl.searchParams)
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  const rows = await prisma.documentVersion.findMany({
    where: buildVersionWhere(filters),
    include: { document: { include: { ownerCostCenter: true, author: true } } },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

  const tableRows = buildPublishedDocumentRows(
    rows.map((row) => ({
      publishedAt: row.publishedAt,
      code: row.document.code,
      revisionNumber: row.revisionNumber,
      title: row.document.title,
      ownerCostCenter: [row.document.ownerCostCenter?.code, row.document.ownerCostCenter?.description].filter(Boolean).join(' - ') || '-',
      author: row.document.author.fullName,
      expiresAt: row.expiresAt,
      status: row.status,
    })),
  )

  if (format === 'pdf') {
    const text = [Array.from(DOCUMENT_PUBLISHED_HEADERS), ...tableRows].map((row) => row.join(' | ')).join('\n')
    return new NextResponse(text, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="documentos-${Date.now()}.pdf"`,
      },
    })
  }

  if (format === 'xlsx') {
    const xlsx = await buildPublishedDocumentsXlsx(DOCUMENT_PUBLISHED_HEADERS, tableRows)
    return new NextResponse(Buffer.from(xlsx), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${buildDocumentsExportFilename('xlsx')}"`,
      },
    })
  }

  const csv = buildExcelFriendlyCsv(DOCUMENT_PUBLISHED_HEADERS, tableRows)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv;charset=utf-8',
      'content-disposition': `attachment; filename="${buildDocumentsExportFilename('csv')}"`,
    },
  })
}
