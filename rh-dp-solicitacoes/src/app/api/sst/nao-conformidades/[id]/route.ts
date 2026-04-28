import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel, NonConformityApprovalStatus, NonConformityStatus, NonConformityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature, canFeature } from '@/lib/permissions'
import { canApproveNc, canManageAllNc, isApproved, shouldSetClosedAt } from '@/lib/sst/nonConformity'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { canUserAccessNc, canUserTreatNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'
import { notifyNonConformityStakeholders } from '@/lib/sst/nonConformityNotifications'
import { type NonConformityNotificationEvent } from '@/lib/sst/nonConformityAlertRules'
import { canEditFirstScreen } from '@/lib/sst/nonConformityPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Usuário não autenticado') {
    return { status: 401, error: message }
  }
  if (message === 'Usuário inativo') {
    return { status: 403, error: message }
  }
  if (message === 'Serviço indisponível. Não foi possível conectar ao banco de dados.') {
    return { status: 503, error: message }
  }

  return null
}

function parseGutValue(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return undefined
  return parsed
}



export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.NAO_CONFORMIDADES, Action.VIEW)
    const canUpdateNc = await canFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.NAO_CONFORMIDADES, Action.UPDATE)

    const nc = await prisma.nonConformity.findUnique({
      where: { id },
      include: {
         planoDeAcao: {
          select: {
            id: true,
            descricao: true,
            prazo: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            responsavelNome: true,
            responsavel: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        estudoCausa: { orderBy: { ordem: 'asc' } },
        anexos: { include: { createdBy: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' } },
        comentarios: { include: { autor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        timeline: { include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        centroQueDetectou: { select: { id: true, description: true } },
        centroQueOriginou: { select: { id: true, description: true } },
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

    const hasSgiQualidadeLevel3 = hasMinLevel(level, ModuleLevel.NIVEL_3)

    return NextResponse.json({
      item: {
        ...nc,
        plano: {
          nonConformityId: nc.id,
          totalAcoes: nc.planoDeAcao.length,
        },
        permissions: {
          canManageAllNc: canManageAllNc(level),
          canApproveQuality: canApproveNc(level),
          canEditFirstScreen: hasSgiQualidadeLevel3 && canUpdateNc,
        },
      },
    })
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError) {
      return NextResponse.json({ error: httpError.error }, { status: httpError.status })
    }
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
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.NAO_CONFORMIDADES, Action.UPDATE)

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

    const touchedFields = Object.keys(body).filter((key) => body[key] !== undefined)
    if (!canEditFirstScreen(canManageAllNc(level), touchedFields)) {

      return NextResponse.json({ error: 'Somente usuários com nível 3 podem editar os dados da 1ª tela da NC.' }, { status: 403 })
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

    let eventToNotify: NonConformityNotificationEvent | null = null
    if (nextStatus && nextStatus !== current.status) {
      if (isReopen) eventToNotify = 'NC_REOPENED'
      else if (nextStatus === NonConformityStatus.CANCELADA) eventToNotify = 'NC_CANCELLED'
      else if (nextStatus === NonConformityStatus.ENCERRADA) eventToNotify = 'NC_CLOSED'
      else if (nextStatus === NonConformityStatus.AGUARDANDO_APROVACAO_QUALIDADE) eventToNotify = 'NC_UPDATED'
    }

    if (eventToNotify) {
      const notificationResult = await notifyNonConformityStakeholders({
        nonConformityId: id,
        actorId: me.id,
        event: eventToNotify,
      })
      if (!notificationResult.sent) {
        console.warn('NC update notification not sent', {
          nonConformityId: id,
          reason: notificationResult.reason,
          event: eventToNotify,
        })
      }
    }

     return NextResponse.json(updated)
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError) {
      return NextResponse.json({ error: httpError.error }, { status: httpError.status })
    }
    console.error('PATCH /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao atualizar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
