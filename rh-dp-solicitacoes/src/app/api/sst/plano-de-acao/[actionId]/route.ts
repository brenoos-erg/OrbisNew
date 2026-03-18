import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionPlanOrigin, NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
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

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const updated = await prisma.nonConformityActionItem.update({
      where: { id: actionId },
      data: {
        descricao: body?.descricao !== undefined ? String(body.descricao || '').trim() : undefined,
        responsavelNome: body?.responsavelNome !== undefined ? (body?.responsavelNome ? String(body.responsavelNome).trim() : null) : undefined,
        prazo: body?.prazo !== undefined ? (body?.prazo ? new Date(String(body.prazo)) : null) : undefined,
        status: Object.values(NonConformityActionStatus).includes(body?.status as NonConformityActionStatus)
          ? (body.status as NonConformityActionStatus)
          : undefined,
        evidencias: body?.evidencias !== undefined ? (body?.evidencias ? String(body.evidencias).trim() : null) : undefined,
        origem: body?.origem !== undefined ? (body?.origem ? String(body.origem).trim() : null) : undefined,
        referencia: body?.referencia !== undefined ? (body?.referencia ? String(body.referencia).trim() : null) : undefined,
        tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType)
          ? (body.tipo as NonConformityActionType)
          : undefined,
        origemPlano: Object.values(NonConformityActionPlanOrigin).includes(body?.origemPlano as NonConformityActionPlanOrigin)
          ? (body.origemPlano as NonConformityActionPlanOrigin)
          : undefined,
      },
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

    await prisma.nonConformityActionItem.delete({ where: { id: actionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
