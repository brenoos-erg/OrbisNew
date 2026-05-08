export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { getUserModuleLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'
import { canViewSensitiveHiringRequest, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { canUserViewNadaConsta } from '@/lib/nadaConstaAccess'
import {
  canApproveSolicitation,
  canAssumeSolicitation,
  canCancelSolicitation,
  canCommentSolicitation,
  canEditSolicitation,
  canFinalizeSolicitation,
  canViewSolicitation,
  isViewerOnlyByPolicy,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'
import { listExperienceEvaluators } from '@/lib/experienceEvaluation'
import { buildSolicitationDetailPayload } from '@/lib/solicitationDetailPayload'
import { VIEWER_ONLY_ACTION_ERROR, isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'

/**
 * GET /api/solicitacoes/[id]
 * Retorna os detalhes completos de uma solicitação específica.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let stage = 'inicio'
  let logContext: Record<string, unknown> = { id }

  try {
    stage = 'buscar-solicitacao'
    const item = await prisma.solicitation.findUnique({ where: { id } })

    if (!item) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    logContext = {
      ...logContext,
      protocolo: item.protocolo,
      tipoId: item.tipoId,
      status: item.status,
    }

    stage = 'usuario-atual'
    const me = await requireActiveUser()
    logContext.usuarioAtual = { id: me.id, email: me.email, login: me.login, role: me.role }

    stage = 'contexto-acesso'
    const [userDepartmentIds, userAccess, extraDepartments] = await Promise.all([
      getUserDepartmentIds(me.id, me.departmentId),
      resolveUserAccessContext({
        userId: me.id,
        userLogin: me.login,
        userEmail: me.email,
        userFullName: me.fullName,
        role: me.role,
        primaryDepartmentId: me.departmentId,
        primaryDepartment: me.department,
      }),
      prisma.userDepartment.findMany({
        where: { userId: me.id },
        include: { department: { select: { id: true, code: true, name: true } } },
      }),
    ])

    stage = 'dados-relacionados-criticos'
    const [tipo, department] = await Promise.all([
      item.tipoId ? prisma.tipoSolicitacao.findUnique({ where: { id: item.tipoId } }) : Promise.resolve(null),
      item.departmentId
        ? prisma.department.findUnique({
            where: { id: item.departmentId },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
    ])

    const solicitationForPolicy = {
      tipoId: item.tipoId,
      status: item.status,
      solicitanteId: item.solicitanteId,
      approverId: item.approverId,
      assumidaPorId: item.assumidaPorId,
      departmentId: item.departmentId,
      solicitacaoSetores: [] as { setor?: string | null }[],
      payload: item.payload ?? {},
    }

    stage = 'setores-para-politica'
    const policySetores = await prisma.solicitacaoSetor.findMany({
      where: { solicitacaoId: item.id },
      select: { setor: true },
      orderBy: { setor: 'asc' },
    })
    solicitationForPolicy.solicitacaoSetores = policySetores

    stage = 'validar-visualizacao'
    const canViewSensitive = canViewSensitiveHiringRequest({
      user: { id: me.id, role: me.role },
      solicitation: {
        solicitanteId: item.solicitanteId,
        assumidaPorId: item.assumidaPorId,
        approverId: item.approverId,
        departmentId: item.departmentId,
        tipo: tipo
          ? {
              id: tipo.id,
              nome: tipo.nome,
              codigo: (tipo as { codigo?: string | null }).codigo ?? null,
            }
          : null,
      },
      isResponsibleDepartmentMember: item.departmentId ? userDepartmentIds.includes(item.departmentId) : false,
    })

    const canViewByDepartment = canViewSolicitation(userAccess, solicitationForPolicy)

    const canViewNadaConsta = canUserViewNadaConsta(
      {
        id: me.id,
        role: me.role,
        departments: [
          ...(me.department ? [me.department] : []),
          ...extraDepartments
            .map((link) => link.department)
            .filter((d): d is { id: string; code: string; name: string } => Boolean(d)),
        ],
      },
      {
        solicitanteId: item.solicitanteId,
        assumidaPorId: item.assumidaPorId,
        approverId: item.approverId,
        tipo: tipo
          ? {
              id: tipo.id,
              nome: tipo.nome,
              schemaJson: tipo.schemaJson,
            }
          : null,
        solicitacaoSetores: policySetores,
        payload: item.payload ?? {},
      },
    )

    if (!canViewSensitive || !canViewNadaConsta || !canViewByDepartment) {
      return NextResponse.json({ error: 'Você não possui permissão para visualizar esta solicitação.' }, { status: 403 })
    }

    stage = 'dados-relacionados-opcionais'
    const attachmentIds = [item.id, item.parentId].filter(Boolean) as string[]
    const [
      approver,
      assumidaPor,
      costCenter,
      nonConformity,
      comentarios,
      eventos,
      timelines,
      solicitacaoSetores,
      children,
      documents,
      allAttachments,
      experienceEvaluators,
    ] = await Promise.all([
      item.approverId ? prisma.user.findUnique({ where: { id: item.approverId }, select: { id: true, fullName: true } }) : Promise.resolve(null),
      item.assumidaPorId ? prisma.user.findUnique({ where: { id: item.assumidaPorId }, select: { id: true, fullName: true } }) : Promise.resolve(null),
      item.costCenterId ? prisma.costCenter.findUnique({ where: { id: item.costCenterId } }) : Promise.resolve(null),
      item.nonConformityId ? prisma.nonConformity.findUnique({ where: { id: item.nonConformityId }, select: { id: true, numeroRnc: true, status: true } }) : Promise.resolve(null),
      prisma.comment.findMany({
        where: { solicitationId: item.id },
        include: { autor: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }).catch((error) => {
        console.error('Falha ao buscar comentários da solicitação', { ...logContext, error })
        return []
      }),
      prisma.event.findMany({ where: { solicitationId: item.id }, orderBy: { createdAt: 'asc' } }).catch((error) => {
        console.error('Falha ao buscar eventos da solicitação', { ...logContext, error })
        return []
      }),
      prisma.solicitationTimeline.findMany({ where: { solicitationId: item.id }, orderBy: { createdAt: 'asc' } }).catch((error) => {
        console.error('Falha ao buscar timeline da solicitação', { ...logContext, error })
        return []
      }),
      prisma.solicitacaoSetor.findMany({ where: { solicitacaoId: item.id }, orderBy: { setor: 'asc' } }).catch((error) => {
        console.error('Falha ao buscar setores da solicitação', { ...logContext, error })
        return []
      }),
      prisma.solicitation.findMany({
        where: { parentId: item.id },
        include: {
          tipo: { select: { nome: true } },
          department: { select: { name: true } },
        },
        orderBy: { dataAbertura: 'asc' },
      }).catch((error) => {
        console.error('Falha ao buscar filhos da solicitação', { ...logContext, error })
        return []
      }),
      prisma.document.findMany({
        where: { solicitationId: item.id },
        include: {
          assignments: {
            select: {
              id: true,
              userId: true,
              status: true,
              signedAt: true,
              vistoriaObservacoes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }).catch((error) => {
        console.error('Falha ao buscar documentos da solicitação', { ...logContext, error })
        return []
      }),
      attachmentIds.length > 0
        ? prisma.attachment.findMany({ where: { solicitationId: { in: attachmentIds } }, orderBy: { createdAt: 'asc' } }).catch((error) => {
            console.error('Falha ao buscar anexos da solicitação', { ...logContext, error })
            return []
          })
        : Promise.resolve([]),
      listExperienceEvaluators().catch((error) => {
        console.error('Falha ao buscar avaliadores de experiência', { ...logContext, error })
        return []
      }),
    ])

    stage = 'montar-permissoes'
    const solicitationForActions = { ...solicitationForPolicy, solicitacaoSetores }
    const viewerOnly = isViewerOnlyByPolicy(userAccess, solicitationForActions)
    const permissions = {
      viewerOnly,
      canAssume: canAssumeSolicitation(userAccess, solicitationForActions),
      canEdit: canEditSolicitation(userAccess, solicitationForActions),
      canApprove: canApproveSolicitation(userAccess, solicitationForActions),
      canFinalize: canFinalizeSolicitation(userAccess, solicitationForActions),
      canCancel: canCancelSolicitation(userAccess, solicitationForActions),
      canComment: canCommentSolicitation(userAccess, solicitationForActions),
    }

    stage = 'montar-payload-resposta'
    const result = buildSolicitationDetailPayload({
      item,
      tipo,
      approver,
      assumidaPor,
      costCenter,
      department,
      nonConformity,
      comentarios,
      eventos,
      timelines,
      solicitacaoSetores,
      children,
      documents,
      attachments: allAttachments,
      experienceEvaluators,
      permissions,
    })

    return NextResponse.json(result)
  } catch (e: any) {
    const stack = e?.stack ?? String(e)
    console.error('❌ GET /api/solicitacoes/[id] error:', {
      ...logContext,
      etapa: stage,
      stack,
    })
    return NextResponse.json(
      {
        error: 'Erro interno ao buscar solicitação.',
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: e?.message ?? String(e), etapa: stage, context: logContext, stack }
          : {}),
      },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/solicitacoes/[id]
 *
 * Neste momento vamos usar o PATCH especificamente para
 * **REPROVAR** a solicitação a partir do painel de aprovação.
 *
 * body: { comment: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser() // usuário logado
    const solicitationId = (await params).id

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId, userId: me.id })
    if (isViewerOnly) {
      return NextResponse.json({ error: VIEWER_ONLY_ACTION_ERROR }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Motivo é obrigatório.' },
        { status: 400 },
      )
    }

    // 1) Buscar solicitação
    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // Só aprova/reprova se estiver pendente de aprovação
    if (
      !solicitation.requiresApproval ||
      solicitation.approvalStatus !== 'PENDENTE'
    ) {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Se tiver aprovador definido, só ele pode reprovar — exceto nível 3
    const moduleLevel = await getUserModuleLevel(me.id, 'solicitacoes')
    const isNivel3 = moduleLevel === ModuleLevel.NIVEL_3

    if (
      solicitation.approverId &&
      solicitation.approverId !== me.id &&
      !isNivel3
    ) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    // 2) Atualizar como REPROVADO / CANCELADA
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

    // 3) Timeline
    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'REPROVADO',
        message: `Reprovado por ${me.fullName ?? me.id}: ${comment}`,
      },
    })

    // 4) Evento
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'REPROVACAO',
      },
    })

    await notifySolicitationEvent({
      solicitationId,
      event: 'REJECTED',
      actorName: me.fullName ?? me.id,
      reason: comment,
      dedupeKey: `REJECTED:${solicitationId}` ,
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ PATCH /api/solicitacoes/[id] (reprovar) error:', e)
    return NextResponse.json(
      { error: 'Erro ao reprovar a solicitação.' },
      { status: 500 },
    )
  }
}
