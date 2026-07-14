import { DocumentVersionStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.CANCELADO
  const where = buildVersionWhere(parsed.filters)
  const fallbackWhere = parsed.filters.code ? buildVersionWhere(parsed.filters, { omitCode: true }) : undefined
  const result = await fetchGrid(
    where,
    parsed.page,
    parsed.pageSize,
    parsed.sortBy,
    parsed.sortOrder,
    parsed.filters.code,
    fallbackWhere,
  )

  return NextResponse.json(result)
}
