export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { isSolicitacaoDesligamento, isSolicitacaoEpiUniforme, isSolicitacaoPessoal, isSolicitacaoAgendamentoFerias, isSolicitacaoVeiculos } from '@/lib/solicitationTypes'
import { notifyWorkflowStepEntry } from '@/lib/solicitationWorkflowNotifications'
import { canNivel3ApproveSolicitation } from '@/lib/solicitationApprovalPermissions'


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
      },
    })

    if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solic.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Esta solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    const canApprove = await canNivel3ApproveSolicitation(me.id, solic.departmentId)
    if (!canApprove) {
      return NextResponse.json(
        { error: 'Você não pode aprovar solicitações deste departamento.' },
        { status: 403 },
      )
    }

   const isSolicitacaoPessoalTipo = isSolicitacaoPessoal(solic.tipo)
    const isSolicitacaoIncentivo =
      solic.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
    const isDesligamento = isSolicitacaoDesligamento(solic.tipo)
    const isFerias = isSolicitacaoAgendamentoFerias(solic.tipo)
    const isVeiculos = isSolicitacaoVeiculos(solic.tipo)    
    const isSolicitacaoEpi = isSolicitacaoEpiUniforme(solic.tipo)

    

    if (isSolicitacaoIncentivo) {
      const allowedCostCenters = new Set<string>()

      if (me.costCenterId) {
        allowedCostCenters.add(me.costCenterId)
      }

      const links = await prisma.userCostCenter.findMany({
        where: { userId: me.id },
       select: { costCenterId: true },
      })

      for (const link of links) {
        allowedCostCenters.add(link.costCenterId)
      }

      if (!solic.costCenterId || !allowedCostCenters.has(solic.costCenterId)) {
        return NextResponse.json(
          {
            error:
              'Somente usuários do setor responsável podem aprovar esta solicitação.',
          },
          { status: 403 },
        )
      }
    }

    let rhCostCenter = null
    let rhDepartment: { id: string; name: string } | null = null

     if (isSolicitacaoPessoalTipo) {
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


    const updateData: Record<string, any> = {
      approvalStatus: 'APROVADO',
      approvalAt: new Date(),
      approverId: me.id,
      approvalComment: approvalComment ?? null,
      status: 'ABERTA',
    }

    if (isSolicitacaoPessoalTipo && rhDepartmentId) {
      updateData.costCenterId = rhCostCenter?.id ?? null
      updateData.departmentId = rhDepartmentId
    } else if (isFerias && dpDepartment) {
      updateData.departmentId = dpDepartment.id
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
    } else if (isDesligamento && dpDepartment) {
      timelineMessage = `Solicitação aprovada. Cópia enviada para ${dpDepartment.name}.`
    } else if (isFerias && dpDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${dpDepartment.name}.`
    } else if (isVeiculos && logisticaDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${logisticaDepartment.name}.`
    } else if (isSolicitacaoEpi && logisticaDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${logisticaDepartment.name}.`
    } else if (isSolicitacaoPessoalTipo && rhDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para o departamento ${rhDepartment.name}.`
    } else {
      timelineMessage = `Solicitação aprovada por ${me.fullName ?? me.id}.`
    }
     if (isDesligamento && dpDepartment) {
      const child = await prisma.solicitation.create({
        data: {
          protocolo: `COPIA-${Date.now()}`,
          tipoId: solic.tipoId,
          titulo: `${solic.titulo} (Cópia DP)`,
          descricao: solic.descricao,
          payload: solic.payload as any,
          solicitanteId: solic.solicitanteId,
          parentId: solic.id,
          departmentId: dpDepartment.id,
          costCenterId: null,
          status: 'ABERTA',
          requiresApproval: false,
          approvalStatus: 'NAO_PRECISA',
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: child.id,
          status: 'ABERTA',
          message: 'Cópia criada automaticamente para tratamento do Departamento Pessoal.',
        },
      })
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
          status: 'AGUARDANDO_ATENDIMENTO',
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

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/aprovar error:', e)
    return NextResponse.json(
      { error: 'Erro ao aprovar a solicitação.' },
      { status: 500 },
    )
  }
}