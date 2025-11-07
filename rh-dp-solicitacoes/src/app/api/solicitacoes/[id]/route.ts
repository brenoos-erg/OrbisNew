import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Status, Prisma } from '@prisma/client'

/**
 * GET /api/solicitacoes/[id]
 * Retorna os detalhes completos de uma solicitação específica.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.solicitation.findUnique({
      where: { id: params.id },
      include: {
        tipo: true,
        comentarios: { include: { autor: { select: { id: true, fullName: true, email: true } } } },
        anexos: true,
        eventos: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (e) {
    console.error('❌ GET /api/solicitacoes/[id] error:', e)
    return NextResponse.json({ error: 'Erro interno ao buscar solicitação' }, { status: 500 })
  }
}

/**
 * PATCH /api/solicitacoes/[id]
 * Atualiza status, responsável ou payload da solicitação.
 * body: { status?: Status, responsavelId?: string | null, payload?: any, actorId?: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const { status, responsavelId, payload, actorId } = body as {
      status?: Status | string
      responsavelId?: string | null
      payload?: unknown
      actorId?: string
    }

    const data: Prisma.SolicitationUpdateInput = {}

    // valida e aplica status
    if (typeof status === 'string') {
      if (!Object.values(Status).includes(status as Status)) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
      }
      data.status = status as Status
    }

// aplica responsável
if (typeof responsavelId === 'string' || responsavelId === null) {
  (data as any).responsavelId = responsavelId
}

    // aplica payload (JSON)
    if (payload !== undefined) {
      data.payload = payload as Prisma.InputJsonValue
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    // atualiza solicitação
    const updated = await prisma.solicitation.update({
      where: { id: params.id },
      data,
      include: {
        tipo: true,
        autor: { select: { id: true, fullName: true, email: true } },
        responsavel: { select: { id: true, fullName: true, email: true } },
      },
    })

    // cria evento de auditoria
    await prisma.event.create({
      data: {
        solicitationId: params.id,
        actorId: actorId ?? updated.responsavelId ?? updated.autorId,
        tipo: 'update',
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ PATCH /api/solicitacoes/[id] error:', e)
    return NextResponse.json({ error: 'Erro interno ao atualizar solicitação' }, { status: 500 })
  }
}
