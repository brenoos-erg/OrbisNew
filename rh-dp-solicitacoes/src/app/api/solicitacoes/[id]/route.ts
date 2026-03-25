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
import { canViewSolicitation, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { listExperienceEvaluators } from '@/lib/experienceEvaluation'

function normalizeStringValue(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function resolveExperienceEvaluatorId(
  campos: Record<string, unknown>,
  evaluators: Array<{ id: string; fullName: string }>,
) {
  const byIdKey = normalizeStringValue(campos.gestorImediatoAvaliadorId)
  if (byIdKey && evaluators.some((user) => user.id === byIdKey)) return byIdKey

  const rawGestor = campos.gestorImediatoAvaliador
  if (rawGestor && typeof rawGestor === 'object' && !Array.isArray(rawGestor)) {
    const byObjectId = normalizeStringValue((rawGestor as Record<string, unknown>).id)
    if (byObjectId && evaluators.some((user) => user.id === byObjectId)) return byObjectId
  }

  const byDirectId = normalizeStringValue(rawGestor)
  if (byDirectId && evaluators.some((user) => user.id === byDirectId)) return byDirectId

  const byName = normalizeStringValue(rawGestor).toLocaleLowerCase('pt-BR')
  if (!byName) return ''

  return evaluators.find((user) => user.fullName.trim().toLocaleLowerCase('pt-BR') === byName)?.id ?? ''
}

/**
 * GET /api/solicitacoes/[id]
 * Retorna os detalhes completos de uma solicitação específica.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const item = await prisma.solicitation.findUnique({
      where: { id: (await params).id },
      include: {
        tipo: true,
        costCenter: true,
        department: { select: { id: true, name: true, code: true } },
        nonConformity: { select: { id: true, numeroRnc: true, status: true } },
        comentarios: {
          include: {
            autor: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
         // anexos buscados separadamente (abaixo)
        parent: true,
        eventos: {
          orderBy: { createdAt: 'asc' },
        },
        timelines: {
          orderBy: { createdAt: 'asc' },
        },
        solicitacaoSetores: {
          orderBy: { setor: 'asc' },
        },
        // 👇 filhos vinculados
        children: {
          include: {
            tipo: { select: { nome: true } },
            department: { select: { name: true } },
          },
          orderBy: { dataAbertura: 'asc' },
        },
        documents: {
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
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }


  const me = await requireActiveUser()
    const [userDepartmentIds, userAccess] = await Promise.all([
      getUserDepartmentIds(me.id, me.departmentId),
      resolveUserAccessContext({
        userId: me.id,
        role: me.role,
        primaryDepartmentId: me.departmentId,
        primaryDepartment: me.department,
      }),
    ])

    const canViewSensitive = canViewSensitiveHiringRequest({
      user: { id: me.id, role: me.role },
      solicitation: {
        solicitanteId: item.solicitanteId,
        assumidaPorId: item.assumidaPorId,
        approverId: item.approverId,
        departmentId: item.departmentId,
        tipo: item.tipo
          ? {
              id: item.tipo.id,
              nome: item.tipo.nome,
              codigo: (item.tipo as { codigo?: string | null }).codigo ?? null,
            }
          : null,
      },
       isResponsibleDepartmentMember: userDepartmentIds.includes(item.departmentId),
    })

    const canViewByDepartment = canViewSolicitation(
      userAccess,
      {
        tipoId: item.tipoId,
        status: item.status,
        solicitanteId: item.solicitanteId,
        approverId: item.approverId,
        assumidaPorId: item.assumidaPorId,
        departmentId: item.departmentId,
        solicitacaoSetores: item.solicitacaoSetores,
      },
    )

    const canViewNadaConsta = canUserViewNadaConsta(
      {
       id: me.id,
        role: me.role,
        departments: [
          ...(me.department ? [me.department] : []),
          ...(await prisma.userDepartment.findMany({
            where: { userId: me.id },
            include: { department: { select: { id: true, code: true, name: true } } },
          })).map((link) => link.department).filter((d): d is { id: string; code: string; name: string } => Boolean(d)),
        ],
      },
      {
        solicitanteId: item.solicitanteId,
        assumidaPorId: item.assumidaPorId,
        approverId: item.approverId,
        tipo: item.tipo
          ? {
              id: item.tipo.id,
              nome: item.tipo.nome,
              schemaJson: item.tipo.schemaJson,
            }
          : null,
        solicitacaoSetores: item.solicitacaoSetores,
        payload: item.payload,
      },
    )

    if (!canViewSensitive || !canViewNadaConsta || !canViewByDepartment) {
      return NextResponse.json({ error: 'Você não possui permissão para visualizar esta solicitação.' }, { status: 403 })
    }

    const attachmentIds = [item.id, item.parentId].filter(Boolean) as string[]
    const allAttachments = await prisma.attachment.findMany({
      where: { solicitationId: { in: attachmentIds } },
      orderBy: { createdAt: 'asc' },
    })

    // Junta anexos da própria solicitação e, se houver, da solicitação de origem
    const seenUrls = new Set<string>()
    const dedupedAttachments = allAttachments.filter((a) => {
      const already = seenUrls.has(a.url)
      if (!already) {
        seenUrls.add(a.url)
      }
      return !already
    })

    const payload = (item.payload ?? {}) as Record<string, unknown>
    const payloadCampos = ((payload.campos as Record<string, unknown> | undefined) ?? {})
    const experienceEvaluators = await listExperienceEvaluators()
    const resolvedEvaluatorId = resolveExperienceEvaluatorId(payloadCampos, experienceEvaluators)
    const normalizedCampos = { ...payloadCampos }
    if (resolvedEvaluatorId) {
      const evaluator = experienceEvaluators.find((value) => value.id === resolvedEvaluatorId)
      normalizedCampos.gestorImediatoAvaliadorId = resolvedEvaluatorId
      if (evaluator) normalizedCampos.gestorImediatoAvaliador = evaluator.fullName
    }

   // Mapeia para o formato que o front espera
    const result = {
   id: item.id,
      protocolo: item.protocolo,
      titulo: item.titulo,
      descricao: item.descricao,

      status: item.status,
      approverId: item.approverId,
      approvalStatus: item.approvalStatus, // 👈 ADICIONAR ISSO

      dataAbertura: item.dataAbertura?.toISOString(),
      dataPrevista: item.dataPrevista?.toISOString() ?? null,
      dataFechamento: item.dataFechamento?.toISOString() ?? null,
      dataCancelamento: item.dataCancelamento?.toISOString() ?? null,
      tipo: item.tipo
        ? {
            id: item.tipo.id,
            codigo: (item.tipo as { codigo?: string | null }).codigo ?? null,
            nome: item.tipo.nome,
            descricao: item.tipo.descricao,
            schemaJson: item.tipo.schemaJson as any,
          }
        : null,
      costCenter: item.costCenter
        ? {
            description: item.costCenter.description,
            code: item.costCenter.code,
            externalCode: item.costCenter.externalCode,
          }
        : null,
        department: item.department
        ? {
           id: item.department.id,
            name: item.department.name,
            code: item.department.code,
          }
         : null,
      payload: {
        ...(payload as Record<string, unknown>),
        campos: normalizedCampos,
      } as any,
      dataSources: {
        experienceEvaluators,
      },
      nonConformity: item.nonConformity
        ? { id: item.nonConformity.id, numeroRnc: item.nonConformity.numeroRnc, status: item.nonConformity.status }
        : null,
      anexos: dedupedAttachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: `/api/solicitacoes/${a.solicitationId}/anexos/${a.id}`,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      comentarios: item.comentarios.map((c) => ({
        id: c.id,
        texto: c.texto,
        createdAt: c.createdAt.toISOString(),
        autor: c.autor
          ? {
              id: c.autor.id,
              fullName: c.autor.fullName,
              email: c.autor.email,
            }
          : null,
      })),
      eventos: item.eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        createdAt: e.createdAt.toISOString(),
        actorId: e.actorId,
      })),
      timelines: item.timelines.map((t) => ({
        id: t.id,
        status: t.status,
        message: t.message,
        createdAt: t.createdAt.toISOString(),
      })),
      solicitacaoSetores: item.solicitacaoSetores.map((setor) => ({
        id: setor.id,
        setor: setor.setor,
        status: setor.status,
        constaFlag: setor.constaFlag,
        campos: setor.campos as any,
        finalizadoEm: setor.finalizadoEm?.toISOString() ?? null,
        finalizadoPor: setor.finalizadoPor ?? null,
      })),
      // 👇 filhos simplificados para o modal
      children: item.children.map((child) => ({
        id: child.id,
        protocolo: child.protocolo,
        titulo: child.titulo,
        status: child.status,
        dataAbertura: child.dataAbertura.toISOString(),
        tipo: child.tipo ? { nome: child.tipo.nome } : null,
        setorDestino: (child as any).department?.name ?? null,
      })),
      documents: item.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        signedPdfUrl: doc.signedPdfUrl,
        createdAt: doc.createdAt.toISOString(),
        assignments: doc.assignments.map((assignment) => ({
          id: assignment.id,
          userId: assignment.userId,
          status: assignment.status,
          signedAt: assignment.signedAt?.toISOString() ?? null,
          vistoriaObservacoes: assignment.vistoriaObservacoes,
        })),
      })),
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('❌ GET /api/solicitacoes/[id] error:', e)
    return NextResponse.json(
      { error: 'Erro interno ao buscar solicitação.' },
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