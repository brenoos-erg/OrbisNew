import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.EM_REVISAO
  return NextResponse.json(await fetchGrid(buildVersionWhere(parsed.filters), parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder))
}