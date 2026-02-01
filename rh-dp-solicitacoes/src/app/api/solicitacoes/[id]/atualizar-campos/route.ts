export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const { id } = params
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Payload inválido.' },
        { status: 400 },
      )
    }

    const { campos, finalizar } = body as {
      campos?: Record<string, string>
      finalizar?: boolean
    }

    if (!campos || typeof campos !== 'object') {
      return NextResponse.json(
        { error: 'Campos são obrigatórios.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (!me.departmentId || solicitation.departmentId !== me.departmentId) {
      return NextResponse.json(
        { error: 'Acesso negado para atualizar esta solicitação.' },
        { status: 403 },
      )
    }

    const payloadOrigem = (solicitation.payload ?? {}) as Record<string, any>
    const camposOrigem = (payloadOrigem.campos ?? {}) as Record<string, any>
    const agora = new Date()

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        payload: {
          ...payloadOrigem,
          campos: {
            ...camposOrigem,
            ...campos,
          },
        },
        ...(finalizar
          ? {
              status: 'CONCLUIDA',
              dataFechamento: agora,
            }
          : {}),
      },
    })

    if (finalizar) {
      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: id,
          status: 'CONCLUIDA',
          message: `Seção finalizada em ${agora.toLocaleDateString('pt-BR')}.`,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/atualizar-campos error', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar campos da solicitação.' },
      { status: 500 },
    )
  }
}