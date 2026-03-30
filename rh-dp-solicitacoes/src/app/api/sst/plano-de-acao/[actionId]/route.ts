import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

function canAccessAction(
  action: { createdById: string | null; responsavelId: string | null; nonConformity?: { solicitanteId: string } | null },
  userId: string,
  isLevel2OrMore: boolean,
) {
  if (isLevel2OrMore) return true
  return action.createdById === userId || action.responsavelId === userId || action.nonConformity?.solicitanteId === userId
}

function toDate(value: unknown) {
  if (value === undefined) return undefined
  if (!value) return null
  return new Date(String(value))
}

function toOptionalString(value: unknown) {
  if (value === undefined) return undefined
  const parsed = String(value || '').trim()
  return parsed || null
}

function toOptionalIntBetween(value: unknown, min = 1, max = 5) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined
  return parsed
}

function toOptionalDecimal(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function resolveStatusForPatch(currentStatus: NonConformityActionStatus, nextStatus: unknown) {
  if (!Object.values(NonConformityActionStatus).includes(nextStatus as NonConformityActionStatus)) return undefined

  const typedStatus = nextStatus as NonConformityActionStatus
  if (typedStatus === NonConformityActionStatus.CONCLUIDA) return typedStatus
  if (typedStatus === NonConformityActionStatus.CANCELADA) return typedStatus

  if (typedStatus === NonConformityActionStatus.PENDENTE || typedStatus === NonConformityActionStatus.EM_ANDAMENTO) {
    if (currentStatus === NonConformityActionStatus.CANCELADA || currentStatus === NonConformityActionStatus.CONCLUIDA) {
      return NonConformityActionStatus.PENDENTE
    }
    return typedStatus
  }

  return undefined
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    const isLevel2OrMore = hasMinLevel(level, ModuleLevel.NIVEL_2)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { actionId } = await params
    const action = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        responsavel: { select: { id: true, fullName: true, email: true } },
        nonConformity: { select: { id: true, numeroRnc: true, solicitanteId: true } },
      },
    })

      if (!action) return NextResponse.json({ error: 'Plano de ação não encontrado.' }, { status: 404 })
    if (!canAccessAction(action, me.id, isLevel2OrMore)) {
      return NextResponse.json({ error: 'Sem permissão para este plano de ação.' }, { status: 403 })
    }
    if (action.nonConformityId) {
      return NextResponse.json({ error: 'Use a rota de não conformidades para ações vinculadas à NC.' }, { status: 400 })
    }

    return NextResponse.json({ item: action })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    const isLevel2OrMore = hasMinLevel(level, ModuleLevel.NIVEL_2)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { actionId } = await params
    const current = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId },
      include: { nonConformity: { select: { solicitanteId: true } } },
    })
    if (!current) return NextResponse.json({ error: 'Plano de ação não encontrado.' }, { status: 404 })
    if (!canAccessAction(current, me.id, isLevel2OrMore)) {
      return NextResponse.json({ error: 'Sem permissão para este plano de ação.' }, { status: 403 })
    }
    if (current.nonConformityId) {
      return NextResponse.json({ error: 'Use a rota de não conformidades para ações vinculadas à NC.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const desiredStatus = resolveStatusForPatch(current.status, body?.status)
    const observacao = String(body?.observacao || '').trim()
    const shouldSetConclusion = desiredStatus === NonConformityActionStatus.CONCLUIDA
    const shouldClearConclusion = desiredStatus === NonConformityActionStatus.PENDENTE || desiredStatus === NonConformityActionStatus.EM_ANDAMENTO

    const baseEvidence =
      body?.evidencias !== undefined ? (body?.evidencias ? String(body.evidencias).trim() : null) : (current?.evidencias || null)
    const evidenciasWithObs = observacao
      ? `${baseEvidence ? `${baseEvidence}\n\n` : ''}[${new Date().toLocaleString('pt-BR')}] ${me.fullName || me.email}: ${observacao}`
      : baseEvidence

    if (desiredStatus === NonConformityActionStatus.CONCLUIDA && !evidenciasWithObs) {
      return NextResponse.json({ error: 'Anexe evidência antes de concluir a ação.' }, { status: 400 })
    }

    const updated = await prisma.nonConformityActionItem.update({
      where: { id: actionId },
      data: {
        descricao: body?.descricao !== undefined ? String(body.descricao || '').trim() : undefined,
        motivoBeneficio: toOptionalString(body?.motivoBeneficio),
        atividadeComo: toOptionalString(body?.atividadeComo),
        centroImpactadoId:
          body?.centroImpactadoId !== undefined ? (body?.centroImpactadoId ? String(body.centroImpactadoId) : null) : undefined,

        centroResponsavelId:
          body?.centroResponsavelId !== undefined ? (body?.centroResponsavelId ? String(body.centroResponsavelId) : null) : undefined,
        dataInicioPrevista: toDate(body?.dataInicioPrevista),
        dataFimPrevista: toDate(body?.dataFimPrevista),
        custo: toOptionalDecimal(body?.custo),
        dataConclusao: shouldSetConclusion ? (toDate(body?.dataConclusao) ?? new Date()) : shouldClearConclusion ? null : toDate(body?.dataConclusao),
          tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType)
          ? (body.tipo as NonConformityActionType)
          : undefined,
        origem: toOptionalString(body?.origem),
        referencia: toOptionalString(body?.referencia),
        rapidez: toOptionalIntBetween(body?.rapidez),
        autonomia: toOptionalIntBetween(body?.autonomia),
        beneficio: toOptionalIntBetween(body?.beneficio),
        responsavelId: body?.responsavelId !== undefined ? (body.responsavelId ? String(body.responsavelId) : null) : undefined,
        responsavelNome:
          body?.responsavelNome !== undefined ? (body?.responsavelNome ? String(body.responsavelNome).trim() : null) : undefined,
        prazo: body?.prazo !== undefined ? (body?.prazo ? new Date(String(body.prazo)) : null) : undefined,
        status: desiredStatus,
        evidencias: observacao || body?.evidencias !== undefined ? evidenciasWithObs : undefined,      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    const isLevel2OrMore = hasMinLevel(level, ModuleLevel.NIVEL_2)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { actionId } = await params
    const current = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId },
      include: { nonConformity: { select: { solicitanteId: true } } },
    })
    if (!current) return NextResponse.json({ error: 'Plano de ação não encontrado.' }, { status: 404 })
    if (!canAccessAction(current, me.id, isLevel2OrMore)) {
      return NextResponse.json({ error: 'Sem permissão para este plano de ação.' }, { status: 403 })
    }
    if (current.nonConformityId) {
      return NextResponse.json({ error: 'Use a rota de não conformidades para ações vinculadas à NC.' }, { status: 400 })
    }

    await prisma.nonConformityActionItem.delete({ where: { id: actionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
