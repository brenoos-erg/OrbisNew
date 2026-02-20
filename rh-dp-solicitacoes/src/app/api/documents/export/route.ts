import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, parseGridParams } from '@/lib/iso-documents'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const { filters } = parseGridParams(req.nextUrl.searchParams)
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  const rows = await prisma.documentVersion.findMany({
    where: buildVersionWhere(filters),
    include: { document: { include: { ownerDepartment: true, author: true } } },
    orderBy: { publishedAt: 'desc' },
  })

  const lines = [
    ['DataPublicacao', 'Codigo', 'NrRevisao', 'Titulo', 'CentroResponsavel', 'Elaborador', 'Vencimento', 'Status'].join(','),
    ...rows.map((r) =>
      [
        r.publishedAt?.toISOString() ?? '',
        r.document.code,
        String(r.revisionNumber),
        JSON.stringify(r.document.title),
        JSON.stringify(r.document.ownerDepartment.name),
        JSON.stringify(r.document.author.fullName),
        r.expiresAt?.toISOString() ?? '',
        r.status,
      ].join(','),
    ),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/octet-stream',
      'content-disposition': `attachment; filename="documentos-${Date.now()}.csv"`,
    },
  })
}