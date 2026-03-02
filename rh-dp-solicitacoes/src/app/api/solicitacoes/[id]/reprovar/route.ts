export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/solicitacoes/[id]/reprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { withModuleLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { resolveTipoApproverIds } from '@/lib/solicitationTipoApprovers'

type RouteParams = { params: Promise<{ id: string }> }


// 🔒 Somente NIVEL_3 no módulo "solicitacoes"
export const POST = withModuleLevel<RouteParams>(
  'solicitacoes',
  ModuleLevel.NIVEL_3,
  async (req: Request, { params, me }) => {
    try {
      const { id: solicitationId } = await params

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
        include: { tipo: true },
      })

      if (!solicit) {
        return NextResponse.json(
          { error: 'Solicitação não encontrada.' },
          { status: 404 },
        )
      }

        const isNivel3 = !!(await prisma.userModuleAccess.findFirst({ where: { userId: me.id, level: 'NIVEL_3', module: { key: 'solicitacoes' } } }))
      if (!isNivel3) {
        return NextResponse.json({ error: 'Somente usuários nível 3 podem aprovar/reprovar.' }, { status: 403 })
      }

       const tipoApproverIds = await resolveTipoApproverIds(solicit.tipoId)
      const canApproveSolicitation =
        solicit.approverId === me.id || tipoApproverIds.includes(me.id)

      if (!canApproveSolicitation) {
        return NextResponse.json({ error: 'Você não é o responsável por esta solicitação.' }, { status: 403 })
      }
      const isSolicitacaoEpi = isSolicitacaoEpiUniforme(solicit.tipo)
      const sstDepartment = isSolicitacaoEpi
        ? await prisma.department.findUnique({ where: { code: '19' }, select: { id: true } })
        : null

      const updated = await prisma.solicitation.update({
        where: { id: solicitationId },
        data: {
          approvalStatus: 'REPROVADO',
          approvalAt: new Date(),
          approvalComment: comment,
          requiresApproval: false,
          status: 'CANCELADA',
          ...(isSolicitacaoEpi && sstDepartment ? { departmentId: sstDepartment.id } : {}),
        },
      })

      if (isSolicitacaoEpi) {
        await prisma.solicitationTimeline.create({
          data: {
            solicitationId,
            status: 'REPROVADO_SETOR',
            message: `Solicitação reprovada pelo aprovador do setor: ${comment}`,
          },
        })
      }

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
