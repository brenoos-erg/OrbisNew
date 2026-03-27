import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityApprovalStatus, NonConformityStatus, NonConformityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { canApproveNc, canManageAllNc, isApproved, shouldSetClosedAt } from '@/lib/sst/nonConformity'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { canUserAccessNc, canUserTreatNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0


function parseGutValue(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return undefined
  return parsed
}


export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nc = await prisma.nonConformity.findUnique({
      where: { id: (await params).id },
      include: {
         planoDeAcao: {
          select: {
            id: true,
            descricao: true,
            responsavelNome: true,
            prazo: true,
            status: true,
            evidencias: true,
            createdAt: true,
            updatedAt: true,
            responsavel: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        estudoCausa: { orderBy: { ordem: 'asc' } },
        anexos: { include: { createdBy: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' } },
        comentarios: { include: { autor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        timeline: { include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        centroQueDetectou: { select: { id: true, description: true } },
        centroQueOriginou: { select: { id: true, description: true } },
        aprovadoQualidadePor: { select: { id: true, fullName: true, email: true } },
        verificacaoEficaciaAprovadoPor: { select: { id: true, fullName: true, email: true } },
          },
    })

   if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

     const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canAccess = canUserAccessNc({
      userId: me.id,
      level,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canAccess) {
      return NextResponse.json({ error: 'Sem permissão para visualizar esta NC.' }, { status: 403 })
    }

     return NextResponse.json({
      item: {
        ...nc,
        plano: {
          codigo: nc.planoAcaoCodigo || `PA-${nc.numeroRnc.replace('RNC-', '')}`,
          objetivo: nc.planoAcaoObjetivo || '',
          evidenciasTratativas: nc.planoAcaoEvidencias || '',
          nonConformityId: nc.id,
          totalAcoes: nc.planoDeAcao.length,
        },
        permissions: {
          canManageAllNc: canManageAllNc(level),
          canApproveQuality: canApproveNc(level),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao carregar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Permissão insuficiente para editar.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const id = (await params).id
    const current = await prisma.nonConformity.findUnique({
      where: { id },
     select: {
        id: true,
        status: true,
        solicitanteId: true,
        aprovadoQualidadeStatus: true,
        centroQueDetectouId: true,
        centroQueOriginouId: true,
      },
    })
    if (!current) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

    const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canTreat = canUserTreatNc({
      userId: me.id,
      level,
      ncSolicitanteId: current.solicitanteId,
      centroQueDetectouId: current.centroQueDetectouId,
      centroQueOriginouId: current.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canTreat) {
      return NextResponse.json({ error: 'Sem permissão para editar esta NC.' }, { status: 403 })
    }

    const approved = isApproved(current.aprovadoQualidadeStatus)
    const nextStatus = body?.status as NonConformityStatus | undefined
    if (nextStatus && !Object.values(NonConformityStatus).includes(nextStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    if (!approved && !canManageAllNc(level)) {
      const onlyBasic = ['descricao', 'evidenciaObjetiva']
      const touched = Object.keys(body).filter((key) => body[key] !== undefined)
      if (touched.some((key) => !onlyBasic.includes(key))) {
        return NextResponse.json({ error: 'Antes da aprovação da qualidade só é permitido editar descrição e evidência objetiva para usuários sem perfil de gestão da Qualidade.' }, { status: 403 })
      }
    }

    if (nextStatus === NonConformityStatus.ENCERRADA && !canManageAllNc(level)) {
      return NextResponse.json({ error: 'Somente nível 3 pode encerrar.' }, { status: 403 })
    }

     if (nextStatus === NonConformityStatus.CANCELADA && !canManageAllNc(level)) {
      return NextResponse.json({ error: 'Somente nível 3 pode cancelar.' }, { status: 403 })
    }

    const isReopen =
      (current.status === NonConformityStatus.ENCERRADA || current.status === NonConformityStatus.CANCELADA) &&
      nextStatus === NonConformityStatus.EM_TRATATIVA

    if (isReopen && !canManageAllNc(level)) {
      return NextResponse.json({ error: 'Somente nível 3 pode reabrir.' }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.nonConformity.update({
        where: { id },
        data: {
           status: nextStatus,
          tipoNc: body?.tipoNc && Object.values(NonConformityType).includes(body.tipoNc) ? body.tipoNc : undefined,
          descricao: body?.descricao !== undefined ? String(body.descricao).trim() : undefined,
          evidenciaObjetiva: body?.evidenciaObjetiva !== undefined ? String(body.evidenciaObjetiva).trim() : undefined,
          referenciaSig: body?.referenciaSig !== undefined ? (body.referenciaSig ? String(body.referenciaSig).trim() : null) : undefined,
          acoesImediatas: body?.acoesImediatas !== undefined ? (body.acoesImediatas ? String(body.acoesImediatas).trim() : null) : undefined,
          planoAcaoCodigo: body?.planoAcaoCodigo !== undefined ? (body.planoAcaoCodigo ? String(body.planoAcaoCodigo).trim() : null) : undefined,
          planoAcaoObjetivo: body?.planoAcaoObjetivo !== undefined ? (body.planoAcaoObjetivo ? String(body.planoAcaoObjetivo).trim() : null) : undefined,
          planoAcaoEvidencias: body?.planoAcaoEvidencias !== undefined ? (body.planoAcaoEvidencias ? String(body.planoAcaoEvidencias).trim() : null) : undefined,
          causaRaiz: body?.causaRaiz !== undefined ? (body.causaRaiz ? String(body.causaRaiz).trim() : null) : undefined,
          gravidade: parseGutValue(body?.gravidade),
          urgencia: parseGutValue(body?.urgencia),
           tendencia: parseGutValue(body?.tendencia),
          fechamentoEm: isReopen ? null : shouldSetClosedAt(nextStatus) ? new Date() : undefined,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: nextStatus && nextStatus !== current.status ? 'STATUS_CHANGE' : 'ATUALIZACAO',
        fromStatus: nextStatus && nextStatus !== current.status ? current.status : undefined,
        toStatus: nextStatus && nextStatus !== current.status ? nextStatus : undefined,
          message:
          nextStatus && nextStatus !== current.status
            ? isReopen
              ? 'Não conformidade reaberta'
              : nextStatus === NonConformityStatus.CANCELADA
                ? 'Não conformidade cancelada'
                : `Status alterado para ${nextStatus}`
            : 'Não conformidade atualizada',
      })

      return item
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao atualizar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}