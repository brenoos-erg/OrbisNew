import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => null)

    const nota = typeof body?.nota === 'string' ? body.nota.trim() : ''
    const comentario =
      typeof body?.comentario === 'string' ? body.comentario.trim() : ''

    if (!nota) {
      return NextResponse.json(
        { error: 'Nota da avaliação é obrigatória.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({ where: { id } })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) {
      return NextResponse.json(
        { error: 'Tipo de solicitação não suportado para avaliação do gestor.' },
        { status: 400 },
      )
    }

    if (solicitation.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Somente o gestor imediato avaliador pode preencher esta etapa.' },
        { status: 403 },
      )
    }

    if ((solicitation.status as string) !== EXPERIENCE_EVALUATION_STATUS) {
      return NextResponse.json(
        { error: 'Solicitação não está aguardando avaliação do gestor.' },
        { status: 400 },
      )
    }

    const payload = (solicitation.payload ?? {}) as Record<string, any>
    const updatedPayload = {
      ...payload,
      avaliacaoGestor: {
        nota,
        comentario,
        avaliadoEm: new Date().toISOString(),
        avaliadorId: me.id,
      },
    }

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        payload: updatedPayload,
        status: 'CONCLUIDA',
        dataFechamento: new Date(),
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'CONCLUIDA',
        message: 'Avaliação do gestor concluída.',
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'AVALIACAO_GESTOR_CONCLUIDA',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/avaliacao-gestor error', error)
    return NextResponse.json(
      { error: 'Erro ao salvar avaliação do gestor.' },
      { status: 500 },
    )
  }
}