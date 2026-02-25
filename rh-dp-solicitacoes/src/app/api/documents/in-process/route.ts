import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)

  const statuses = [
    DocumentVersionStatus.EM_ELABORACAO,
    DocumentVersionStatus.EM_REVISAO,
    DocumentVersionStatus.EM_ANALISE_QUALIDADE,
    DocumentVersionStatus.AG_APROVACAO,
  ]

  const where = buildVersionWhere({ ...parsed.filters, status: null }) as any
  where.status = { in: statuses }

  const [grid, legend] = await Promise.all([
    fetchGrid(where, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder),
    prisma.documentVersion.groupBy({ by: ['status'], _count: { _all: true }, where: { status: { in: statuses } } }),
  ])

  return NextResponse.json({ ...grid, legend })
}
