import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.EM_ANALISE_QUALIDADE
  const where = {
    ...buildVersionWhere(parsed.filters),
    approvalRounds: { some: { status: 'PENDING', steps: { some: { status: 'PENDING', stepType: 'QUALITY', decisions: { some: { userId: me.id, status: 'PENDING' } } } } } },
  }
  return NextResponse.json(await fetchGrid(where as any, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder, undefined, undefined, me.id))
}
