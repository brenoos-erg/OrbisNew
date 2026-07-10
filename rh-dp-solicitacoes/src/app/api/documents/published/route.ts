import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import {
  buildDocumentCodeSearchVariants,
  buildVersionWhere,
  explainPublishedVisibility,
  fetchGrid,
  normalizeDocumentCodeSearch,
  parseGridParams,
} from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.PUBLICADO
  const where = buildVersionWhere(parsed.filters)
  const fallbackWhere = parsed.filters.code ? buildVersionWhere(parsed.filters, { omitCode: true }) : undefined
  const result = await fetchGrid(where, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder, parsed.filters.code, fallbackWhere)
  const debugRequested = req.nextUrl.searchParams.get('debug') === '1' || process.env.NODE_ENV === 'development'
  const code = req.nextUrl.searchParams.get('code')
  if (debugRequested && code) {
    const codeOriginal = String(code ?? '').trim()
    const codeNormalized = normalizeDocumentCodeSearch(codeOriginal)
    const variantsTested = buildDocumentCodeSearchVariants(codeOriginal)
    const debug = {
      ...(await explainPublishedVisibility(codeOriginal, where, result.total)),
      codeOriginal,
      codeNormalized,
      variantsTested,
      totalEncontrado: result.total,
    }
    console.info('[documents.published] debug', debug)
    return NextResponse.json({ ...result, debug })
  }
  return NextResponse.json(result)
}