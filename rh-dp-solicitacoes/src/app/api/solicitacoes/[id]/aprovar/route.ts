export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { isSolicitacaoDesligamento, isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'


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

    const isSolicitacaoPessoal =
      solic.tipo?.nome === 'RQ_063 - Solicitação de Pessoal'
    const isSolicitacaoIncentivo =
      solic.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
      const isDesligamento = isSolicitacaoDesligamento(solic.tipo)
    const isSolicitacaoEpi = isSolicitacaoEpiUniforme(solic.tipo)

    if (isSolicitacaoEpi) {
      const [hasNivel3Solicitacoes, userSstLink] = await Promise.all([
        prisma.userModuleAccess.findFirst({
          where: {
            userId: me.id,
            level: 'NIVEL_3',
            module: { key: 'solicitacoes' },
          },
          select: { id: true },
        }),
        prisma.userDepartment.findFirst({
          where: {
            userId: me.id,
            department: { code: '19' },
          },
          select: { id: true },
        }),
      ])
      const isSstUser =
        me.department?.code === '19' ||
        Boolean(userSstLink)

      if (!hasNivel3Solicitacoes || !isSstUser) {
        return NextResponse.json(
          {
            error:
              'Somente aprovadores nível 3 de solicitações do departamento SST podem aprovar esta solicitação.',
          },
          { status: 403 },
        )
      }
    }

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

    if (isSolicitacaoPessoal || isDesligamento) {
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

      if (!rhCostCenter) {
        return NextResponse.json(
          {
            error:
              'Centro de custo de Recursos Humanos não encontrado para encaminhar a solicitação aprovada.',
          },
          { status: 400 },
        )
      }
    }

    const rhDepartmentId =
      rhCostCenter?.departmentId ?? solic.costCenter?.departmentId ?? solic.departmentId
       let logisticaDepartment = null
    if (isSolicitacaoEpi) {
      logisticaDepartment = await prisma.department.findUnique({
        where: { code: '11' },
        select: { id: true, name: true },
      })

      if (!logisticaDepartment) {
        return NextResponse.json(
          { error: 'Departamento LOGÍSTICA não encontrado para encaminhamento.' },
          { status: 400 },
        )
      }
    }

    if (rhCostCenter && !rhDepartmentId) {
      return NextResponse.json(
        {
          error:
            'Departamento do centro de custo de RH não encontrado para encaminhar a solicitação aprovada.',
        },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'APROVADO',
        approvalAt: new Date(),
        approverId: me.id,
        approvalComment: approvalComment ?? null,
        // Depois de aprovado, volta para ABERTA,
        // e o front interpreta como "Aguardando atendimento"
        status: 'ABERTA',
        ...(rhCostCenter
          ? {
              costCenterId: rhCostCenter.id,
              departmentId: rhDepartmentId,
            }
          : {}),
          ...(isSolicitacaoEpi && logisticaDepartment
          ? {
              departmentId: logisticaDepartment.id,
              payload: {
                ...((solic.payload as Record<string, any> | null) ?? {}),
                epiUniforme: {
                  ...(((solic.payload as Record<string, any> | null)?.epiUniforme as
                    Record<string, any> | undefined) ?? {}),
                  centroResponsavelLabel: logisticaDepartment.name,
                },
              },
            }
          : {}),
      },
    })

    let timelineMessage: string

    if (approvalComment && approvalComment.length > 0) {
      timelineMessage = approvalComment
       } else if (isSolicitacaoEpi && logisticaDepartment) {
      timelineMessage = `Solicitação aprovada e encaminhada para ${logisticaDepartment.name}.`
    } else if (rhCostCenter) {
      const rhName = rhCostCenter.description ?? rhCostCenter.code ?? rhCostCenter.id
      timelineMessage = `Solicitação aprovada e encaminhada para o RH (${rhName}).`
    } else {
      timelineMessage = `Solicitação aprovada por ${me.fullName ?? me.id}.`
    }


    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'AGUARDANDO_ATENDIMENTO',
        message: timelineMessage,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'APROVACAO_GESTOR',
      },
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