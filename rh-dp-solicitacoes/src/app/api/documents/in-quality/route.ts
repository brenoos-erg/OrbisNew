import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canAccessQualityReviewDocuments } from '@/lib/documentApprovalControl'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  const canAccess = await canAccessQualityReviewDocuments(me.id, me.role)
  if (!canAccess) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.EM_ANALISE_QUALIDADE
  return NextResponse.json(await fetchGrid(buildVersionWhere(parsed.filters), parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder))
}