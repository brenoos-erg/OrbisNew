import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()

  const page = Math.max(Number(req.nextUrl.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') ?? '20') || 20, 1), 100)

  const code = req.nextUrl.searchParams.get('code') ?? undefined
  const title = req.nextUrl.searchParams.get('title') ?? undefined

  const where = {
    version: {
      document: {
        code: code ? { contains: code } : undefined,
        title: title ? { contains: title } : undefined,
      },
    },
  }

  const [total, rows] = await Promise.all([
    prisma.documentDownloadLog.count({ where }),
    prisma.documentDownloadLog.findMany({
      where,
      include: { version: { include: { document: { include: { ownerDepartment: true, author: true } } } }, user: true },
      orderBy: { downloadedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: rows.map((log) => ({
      versionId: log.versionId,
      dataPublicacao: log.version?.publishedAt ?? null,
      codigo: log.version.document.code,
      nrRevisao: log.version.revisionNumber,
      titulo: log.version.document.title,
      centroResponsavel: log.version.document.ownerDepartment.name,
      elaborador: log.version.document.author.fullName,
      vencimento: log.version.expiresAt,
      status: `DOWNLOAD por ${log.user.fullName}`,
      downloadedAt: log.downloadedAt,
    })),
  })
}