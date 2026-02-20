import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  if (me.department?.code !== '16' && me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso restrito ao departamento de qualidade.' }, { status: 403 })
  }
  const parsed = parseGridParams(req.nextUrl.searchParams)
  parsed.filters.status = DocumentVersionStatus.EM_ANALISE_QUALIDADE
  return NextResponse.json(await fetchGrid(buildVersionWhere(parsed.filters), parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder))
}