// src/app/api/solicitacoes/[id]/reprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { withModuleLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { id: string } }

// 🔒 Somente NIVEL_3 no módulo "solicitacoes"
export const POST = withModuleLevel<RouteParams>(
  'solicitacoes',
  ModuleLevel.NIVEL_3,
  async (req: Request, { params, me }) => {
    try {
      const { id: solicitationId } = params

      const body = await req.json().catch(() => ({}))
      const comment: string | undefined = body.comment

      if (!comment || comment.trim().length === 0) {
        return NextResponse.json(
          { error: 'Comentário é obrigatório para reprovar.' },
          { status: 400 },
        )
      }

      const solicit = await prisma.solicitation.findUnique({
        where: { id: solicitationId },
      })

      if (!solicit) {
        return NextResponse.json(
          { error: 'Solicitação não encontrada.' },
          { status: 404 },
        )
      }

      const isPendingApproval =
        solicit.approvalStatus === 'PENDENTE' ||
        solicit.status === 'AGUARDANDO_APROVACAO'

      if (!isPendingApproval) {
        return NextResponse.json(
          { error: 'Solicitação não está pendente de aprovação.' },
          { status: 400 },
        )
      }

      if (solicit.approverId && solicit.approverId !== me.id) {
        return NextResponse.json(
          { error: 'Você não é o aprovador desta solicitação.' },
          { status: 403 },
        )
      }

      const updated = await prisma.solicitation.update({
        where: { id: solicitationId },
        data: {
          approvalStatus: 'REPROVADO',
          approvalAt: new Date(),
          approvalComment: comment,
          requiresApproval: false,
          status: 'CANCELADA',
        },
      })

      await prisma.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId,
          actorId: me.id,
          tipo: 'REPROVACAO',
        },
      })

      return NextResponse.json(updated)
    } catch (e) {
      console.error('POST /api/solicitacoes/[id]/reprovar error', e)
      return NextResponse.json(
        { error: 'Erro ao reprovar a solicitação.' },
        { status: 500 },
      )
    }
  },
)
