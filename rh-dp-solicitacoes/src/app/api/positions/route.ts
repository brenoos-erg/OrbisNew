export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Action } from '@prisma/client'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireActiveUser } from '@/lib/auth'
import { withRequestMetrics } from "@/lib/request-metrics"
import { getPrismaP2000Message, getPrismaP2002Message, positionDataFromBody, positionSelect, withCurrentDocument } from './positionFields'
import { attachPreviewedPositionDocument } from '@/lib/positions/positionDocumentStorage'
import { canAccessRhPositions } from '@/lib/rhPositionsAccess'

export async function GET(req: Request) {
  return withRequestMetrics('GET /api/positions', async () => {
    try {
      await requireActiveUser()
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
      if ((error as Error)?.message === 'Usuário não autenticado') return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
      console.error('Erro em GET /api/positions:', error)
      return NextResponse.json({ error: 'Erro ao buscar cargos' }, { status: 500 })
    }
  })
}

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser()
    if (!(await canAccessRhPositions(user, Action.CREATE))) {
      return NextResponse.json({ error: 'Sem permissão para criar cargos.' }, { status: 403 })
    }

    const body = await request.json()
    if (!body?.name?.trim()) return NextResponse.json({ error: 'Nome do cargo é obrigatório.' }, { status: 400 })
    const created = await prisma.position.create({ data: positionDataFromBody(body) as any, select: positionSelect })

    if (body.tempFileToken) {
      await attachPreviewedPositionDocument({
        prisma,
        positionId: created.id,
        uploadedById: user.id,
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
    const p2000Message = getPrismaP2000Message(error)
    if (p2000Message) return NextResponse.json({ error: p2000Message }, { status: 400 })
    const p2002Message = getPrismaP2002Message(error)
    if (p2002Message) return NextResponse.json({ error: p2002Message }, { status: 400 })
    if ((error as Error)?.message === 'Data do documento inválida.') return NextResponse.json({ error: 'Data do documento inválida.' }, { status: 400 })
    if ((error as Error)?.message === 'Usuário não autenticado') return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    console.error('POST /api/positions error', error)
    return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 })
  }
}
