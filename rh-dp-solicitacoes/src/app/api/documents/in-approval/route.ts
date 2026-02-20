import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.AG_APROVACAO
  return NextResponse.json(await fetchGrid(buildVersionWhere(parsed.filters), parsed.page, parsed.pageSize))
}