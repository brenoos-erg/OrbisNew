import { ModuleLevel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { readWorkflowRows } from '@/lib/solicitationWorkflowsStore'

const TIMELINE_DONE = new Set(['CONCLUIDA', 'ENCERRADA', 'APROVADA'])

export const GET = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_1,
  async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params
    const term = decodeURIComponent(id).trim()

    const solicitation = await prisma.solicitation.findFirst({
      where: {
        OR: [
          { id: term },
          { protocolo: term },
          { solicitante: { fullName: { contains: term } } },
        ],
      },
      include: {
        tipo: { select: { nome: true } },
        solicitante: { select: { fullName: true } },
        department: { select: { id: true, name: true } },
        assumidaPor: { select: { fullName: true } },
        approver: { select: { id: true, fullName: true } },
        timelines: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    const workflows = await readWorkflowRows()
    const workflow = workflows.find((row) => row.tipoId === solicitation.tipoId)
    const orderedSteps = workflow?.steps?.filter((step) => step.kind !== 'FIM') ?? []

    const inApproval = solicitation.approvalStatus === 'PENDENTE'
    const currentType = inApproval ? 'APPROVERS' : 'DEPARTMENT'
    const currentLabel = inApproval
      ? 'Aprovação'
      : orderedSteps.find((step) => step.kind === 'DEPARTAMENTO')?.label ?? solicitation.department?.name ?? 'Etapa atual'

    const approverIds = Array.from(
      new Set(orderedSteps.filter((step) => step.kind === 'APROVACAO').flatMap((step) => step.approverUserIds ?? [])),
    )

    const approvers = approverIds.length
      ? await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, fullName: true },
          orderBy: { fullName: 'asc' },
        })
      : solicitation.approver
        ? [{ id: solicitation.approver.id, fullName: solicitation.approver.fullName }]
        : []

    const approvalStatusMap = {
      PENDENTE: 'PENDING',
      APROVADO: 'APPROVED',
      REPROVADO: 'REJECTED',
      NAO_PRECISA: 'PENDING',
    } as const

    const aprovacoes = approvers.map((aprovador) => ({
      aprovador: aprovador.fullName,
      status: approvalStatusMap[solicitation.approvalStatus] ?? 'PENDING',
    }))

    const timelinePoints = solicitation.timelines
    const currentStepIndex = solicitation.status === 'CONCLUIDA' ? Number.MAX_SAFE_INTEGER : 0

    const historico = (
      orderedSteps.length
        ? orderedSteps
        : [{ order: 1, label: currentLabel, kind: inApproval ? 'APROVACAO' : 'DEPARTAMENTO' as const }]
    ).map((step, index) => {
      const isDone = index < currentStepIndex
      const isCurrent = !isDone && index === currentStepIndex

      return {
        etapa: step.label,
        tipo: step.kind === 'APROVACAO' ? 'APPROVERS' : 'DEPARTMENT',
        status: isDone ? 'FINALIZADO' : isCurrent ? 'EM ANDAMENTO' : 'PENDENTE',
        dataInicio: timelinePoints[index]?.createdAt ?? null,
        dataFim: isDone ? timelinePoints[index + 1]?.createdAt ?? solicitation.dataFechamento : null,
      }
    })

    const currentTimelineStatus = solicitation.timelines.at(-1)?.status ?? solicitation.status

    return NextResponse.json({
      solicitacao: {
        id: solicitation.id,
        protocolo: solicitation.protocolo,
        tipo: solicitation.tipo.nome,
        solicitante: solicitation.solicitante.fullName,
        status: solicitation.status,
      },
      etapaAtual: {
        id: solicitation.id,
        nome: currentLabel,
        tipo: currentType,
        departamento: solicitation.department?.name ?? null,
        responsavelAtual: solicitation.assumidaPor?.fullName ?? solicitation.approver?.fullName ?? null,
        status: TIMELINE_DONE.has(currentTimelineStatus) ? 'FINALIZADO' : 'EM ANDAMENTO',
      },
      aprovacoes,
      historico,
    })
  },
)