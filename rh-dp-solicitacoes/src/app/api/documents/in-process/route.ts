import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const page = Number(req.nextUrl.searchParams.get('page') ?? '1') || 1
  const pageSize = Number(req.nextUrl.searchParams.get('pageSize') ?? '20') || 20

  const statuses = [
    DocumentVersionStatus.EM_ELABORACAO,
    DocumentVersionStatus.EM_REVISAO,
    DocumentVersionStatus.EM_ANALISE_QUALIDADE,
    DocumentVersionStatus.AG_APROVACAO,
  ]

  const [total, items, legend] = await Promise.all([
    prisma.documentVersion.count({ where: { status: { in: statuses } } }),
    prisma.documentVersion.findMany({
      where: { status: { in: statuses } },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.documentVersion.groupBy({ by: ['status'], _count: { _all: true }, where: { status: { in: statuses } } }),
  ])

  return NextResponse.json({ total, page, pageSize, legend, items })
}