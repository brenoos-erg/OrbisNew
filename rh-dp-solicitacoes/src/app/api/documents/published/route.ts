import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, explainPublishedVisibility, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.PUBLICADO
  const where = buildVersionWhere(parsed.filters)
  const result = await fetchGrid(where, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder)
  const debugRequested = req.nextUrl.searchParams.get('debug') === '1' || process.env.NODE_ENV === 'development'
  const code = req.nextUrl.searchParams.get('code')
  if (debugRequested && code) {
    const debug = await explainPublishedVisibility(code, where, result.total)
    console.info('[documents.published] debug', debug)
    return NextResponse.json({ ...result, debug })
  }
  return NextResponse.json(result)
}