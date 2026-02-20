import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, parseGridParams } from '@/lib/iso-documents'
import { prisma } from '@/lib/prisma'

function toCsv(rows: string[][]) {
  return rows
    .map((line) =>
      line
        .map((value) => {
          const escaped = value.replaceAll('"', '""')
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
        })
        .join(','),
    )
    .join('\n')
}

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const { filters } = parseGridParams(req.nextUrl.searchParams)
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  const rows = await prisma.documentVersion.findMany({
    where: buildVersionWhere(filters),
    include: { document: { include: { ownerDepartment: true, author: true } } },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

  const tableRows = [
    ['DataPublicacao', 'Codigo', 'NrRevisao', 'Titulo', 'CentroResponsavel', 'Elaborador', 'Vencimento', 'Status'],
    ...rows.map((r) => [
      r.publishedAt?.toISOString() ?? '',
      r.document.code,
      String(r.revisionNumber),
      r.document.title,
      r.document.ownerDepartment.name,
      r.document.author.fullName,
      r.expiresAt?.toISOString() ?? '',
      r.status,
    ]),
  ]

  if (format === 'pdf') {
    const text = tableRows.map((row) => row.join(' | ')).join('\n')
    return new NextResponse(text, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="documentos-${Date.now()}.pdf"`,
      },
    })
  }

  const csv = toCsv(tableRows)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="documentos-${Date.now()}.csv"`,
    },
  })
}