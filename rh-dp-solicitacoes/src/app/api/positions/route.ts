export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireActiveUser } from '@/lib/auth'
import { withRequestMetrics } from "@/lib/request-metrics"
import { positionDataFromBody, positionSelect, withCurrentDocument } from './positionFields'
import { attachPreviewedPositionDocument } from '@/lib/positions/positionDocumentStorage'

export async function GET(req: Request) {
  return withRequestMetrics('GET /api/positions', async () => {
    try {
      const url = new URL(req.url)
      const includeInactive = url.searchParams.get('includeInactive') === 'true'
      const q = (url.searchParams.get('q') ?? '').trim()
      const positions = await prisma.position.findMany({
        where: { active: includeInactive ? undefined : true, ...(q ? { OR: [{ name: { contains: q } }, { indexador: { contains: q } }, { areaSector: { contains: q } }, { cbo: { contains: q } }] } : {}) },
        select: positionSelect,
        orderBy: { name: 'asc' },
      })
      const items = positions.map(withCurrentDocument)
      return NextResponse.json({ items, total: items.length }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('Erro em GET /api/positions:', error)
      return NextResponse.json({ error: 'Erro ao buscar cargos' }, { status: 500 })
    }
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body?.name?.trim()) return NextResponse.json({ error: 'Nome do cargo é obrigatório.' }, { status: 400 })
    const created = await prisma.position.create({ data: positionDataFromBody(body) as any, select: positionSelect })

    if (body.tempFileToken) {
      const me = await requireActiveUser()
      await attachPreviewedPositionDocument({
        prisma,
        positionId: created.id,
        uploadedById: me.id,
        tempFileToken: body.tempFileToken,
        originalFilename: body.documentOriginalFilename ?? 'documento-cargo',
        mimeType: body.documentMimeType ?? null,
        sizeBytes: body.documentSizeBytes ?? null,
        parsedText: body.parsedText ?? null,
        extracted: body.extractedDocument ?? null,
      })
    }

    const reloaded = await prisma.position.findUnique({ where: { id: created.id }, select: positionSelect })
    return NextResponse.json(withCurrentDocument(reloaded ?? created), { status: 201 })
  } catch (error) {
    console.error('POST /api/positions error', error)
    return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 })
  }
}
