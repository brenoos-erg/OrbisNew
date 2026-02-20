import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { buildVersionWhere, fetchGrid, parseGridParams } from '@/lib/iso-documents'

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser()
    const { page, pageSize, filters } = parseGridParams(req.nextUrl.searchParams)
    const where = buildVersionWhere(filters)
    return NextResponse.json(await fetchGrid(where, page, pageSize))
  } catch (error) {
    console.error('Erro ao consultar documentos ISO', error)
    return NextResponse.json({ error: 'Erro ao consultar documentos.' }, { status: 500 })
  }
}