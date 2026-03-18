export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { isSolicitacaoDesligamento, isSolicitacaoEpiUniforme, isSolicitacaoPessoal, isSolicitacaoAgendamentoFerias, isSolicitacaoVeiculos } from '@/lib/solicitationTypes'
import { notifyWorkflowStepEntry } from '@/lib/solicitationWorkflowNotifications'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { resolveTipoApproverIds } from '@/lib/solicitationTipoApprovers'
import { isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import { getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id
    const body = (await req.json().catch(() => ({}))) as {
      comment?: string
    }
    const approvalComment = body.comment?.trim()


    const solic = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: {
        tipo: true,
        costCenter: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }


    const isViewerOnly = await isViewerOnlyForSolicitation({
      solicitationId,
      userId: me.id,
    })
    if (isViewerOnly) {
      return NextResponse.json({ error: 'Usuário visualizador não pode aprovar solicitações.' }, { status: 403 })
    }
    if (solic.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Esta solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

   const isNivel3 = !!(await prisma.userModuleAccess.findFirst({ where: { userId: me.id, level: 'NIVEL_3', module: { key: 'solicitacoes' } } }))
    if (!isNivel3) {
      return NextResponse.json({ error: 'Somente usuários nível 3 podem aprovar/reprovar.' }, { status: 403 })
    }

    const userDepartmentIds = await getUserDepartmentIds(me.id, me.departmentId)
    const tipoApproverIds = await resolveTipoApproverIds(solic.tipoId)
    const canApproveByDepartment =
      userDepartmentIds.includes(solic.departmentId) &&
      me.moduleLevels?.solicitacoes === 'NIVEL_3'
    const canApproveSolicitation =
      solic.approverId === me.id ||
      tipoApproverIds.includes(me.id) ||
      canApproveByDepartment

    if (!canApproveSolicitation) {
      return NextResponse.json({ error: 'Você não é o responsável por esta solicitação.' }, { status: 403 })
    }
  const isSolicitacaoPessoalTipo = isSolicitacaoPessoal(solic.tipo)
    const isDesligamento = isSolicitacaoDesligamento(solic.tipo)
    const isFerias = isSolicitacaoAgendamentoFerias(solic.tipo)
    const isVeiculos = isSolicitacaoVeiculos(solic.tipo)    
    const isSolicitacaoEpi = isSolicitacaoEpiUniforme(solic.tipo)

    


    let rhCostCenter = null
    let rhDepartment: { id: string; name: string } | null = null

     if (isSolicitacaoPessoalTipo || isDesligamento) {
      rhDepartment = await prisma.department.findFirst({
        where: {
          OR: [
            { code: '17' },
            { name: { contains: 'Recursos Humanos' } },
            { sigla: { contains: 'RH' } },
          ],
        },
        select: { id: true, name: true },
      })

      if (!rhDepartment) {
        return NextResponse.json(
          {
            error:
              'Departamento de Recursos Humanos não encontrado para encaminhar a solicitação aprovada.',
          },
          { status: 400 },
        )
      }
   rhCostCenter = await prisma.costCenter.findFirst({
        where: {
          OR: [
            {
              description: { contains: 'Recursos Humanos' },
            },
            { abbreviation: { contains: 'RH' } },
            { code: { contains: 'RH' } },
          ],
        },
      })
    }

    const rhDepartmentId = rhDepartment?.id
      const dpDepartment = await prisma.department.findUnique({ where: { code: '08' }, select: { id: true, name: true } })
    const logisticaDepartment = await prisma.department.findUnique({ where: { code: '11' }, select: { id: true, name: true } })


    const isFeriasDpStage = isFerias && solic.department?.code === '08'

    const updateData: Record<string, any> = {
      approvalStatus: isFerias && !isFeriasDpStage ? 'PENDENTE' : 'APROVADO',
      approvalAt: new Date(),
      approverId: me.id,
      approvalComment: approvalComment ?? null,
      requiresApproval: isFerias && !isFeriasDpStage,
      status: isSolicitacaoEpi
        ? 'EM_ATENDIMENTO'
        : isFerias && !isFeriasDpStage
          ? 'AGUARDANDO_APROVACAO'
          : 'ABERTA',
    }

  if ((isSolicitacaoPessoalTipo || isDesligamento) && rhDepartmentId) {
      updateData.costCenterId = rhCostCenter?.id ?? null
      updateData.departmentId = rhDepartmentId
    } else if (isFerias && dpDepartment) {
      updateData.departmentId = dpDepartment.id
      if (!isFeriasDpStage) {
        updateData.approverId = null
        updateData.approvalAt = null
      }
    } else if ((isVeiculos || isSolicitacaoEpi) && logisticaDepartment) {
      updateData.departmentId = logisticaDepartment.id
    }

    if (isSolicitacaoEpi && logisticaDepartment) {
      updateData.payload = {
        ...((solic.payload as Record<string, any> | null) ?? {}),
        epiUniforme: {
          ...(((solic.payload as Record<string, any> | null)?.epiUniforme as Record<string, any> | undefined) ?? {}),
          centroResponsavelLabel: logisticaDepartment.name,
        },
      }
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: updateData,
    })

     let timelineMessage: string

    if (approvalComment && approvalComment.length > 0) {
      timelineMessage = approvalComment
    } else if (isDesligamento && rhDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${rhDepartment.name}.`
    } else if (isFerias && dpDepartment && !isFeriasDpStage) {
      timelineMessage = `Solicitação aprovada pelo gestor e encaminhada para aprovação do ${dpDepartment.name}.`
    } else if (isFerias && dpDepartment && isFeriasDpStage) {
      timelineMessage = `Solicitação aprovada pelo ${dpDepartment.name} e liberada para atendimento.`
    } else if (isVeiculos && logisticaDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${logisticaDepartment.name}.`
    } else if (isSolicitacaoEpi && logisticaDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${logisticaDepartment.name}.`
    } else if (isSolicitacaoPessoalTipo && rhDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para o departamento ${rhDepartment.name}.`
    } else {
      timelineMessage = `Solicitação aprovada por ${me.fullName ?? me.id}.`
    }


     if (isSolicitacaoEpi && logisticaDepartment) {
      await prisma.solicitationTimeline.create({
        data: {
          solicitationId,
          status: 'APROVADO_SETOR',
          message: `Solicitação aprovada por ${me.fullName ?? me.id}.`,
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId,
          status: 'ENCAMINHADA_LOGISTICA',
          message: `Solicitação encaminhada para ${logisticaDepartment.name} após aprovação do setor.`,
        },
       })
    } else {
      await prisma.solicitationTimeline.create({
        data: {
          solicitationId,
          status: isFerias && !isFeriasDpStage ? 'AGUARDANDO_APROVACAO' : 'AGUARDANDO_ATENDIMENTO',
          message: timelineMessage,
        },
      })
    }

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'APROVACAO_GESTOR',
      },
    })

     await notifyWorkflowStepEntry({
      solicitationId,
      preferredDepartmentId: updated.departmentId,
    })

    await notifySolicitationEvent({
      solicitationId,
      event: updated.approvalStatus === 'PENDENTE' ? 'AWAITING_APPROVAL' : 'APPROVED',
      actorName: me.fullName ?? me.id,
      reason: timelineMessage,
      dedupeKey: `APPROVE:${updated.id}:${updated.departmentId}:${updated.approvalStatus}` ,
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/aprovar error:', e)
    return NextResponse.json(
      { error: 'Erro ao aprovar a solicitação.' },
      { status: 500 },
    )
  }
}