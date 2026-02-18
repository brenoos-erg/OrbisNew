import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

async function assertEditable(id: string, userId: string, level: ModuleLevel | undefined) {
  const nc = await prisma.nonConformity.findUnique({ where: { id }, select: { solicitanteId: true, aprovadoQualidadeStatus: true } })
  if (!nc) return { error: 'Não conformidade não encontrada.', status: 404 }
  if (nc.aprovadoQualidadeStatus !== 'APROVADO') return { error: 'Plano de ação só pode ser alterado após aprovação da qualidade.', status: 403 }
  if (nc.solicitanteId !== userId && !hasMinLevel(level, ModuleLevel.NIVEL_2)) return { error: 'Sem permissão para esta NC.', status: 403 }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

     const body = await req.json().catch(() => ({} as any))
    const descricao = String(body?.descricao || '').trim()
    if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.nonConformityActionItem.create({
        data: {
          nonConformityId: id,
          descricao,
          responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
          responsavelNome: body?.responsavelNome ? String(body.responsavelNome).trim() : null,
          prazo: body?.prazo ? new Date(body.prazo) : null,
          status: Object.values(NonConformityActionStatus).includes(body?.status) ? body.status : NonConformityActionStatus.PENDENTE,
          evidencias: body?.evidencias ? String(body.evidencias).trim() : null,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${created.id} criada no plano de ação (${created.status})${created.descricao ? ` - ${created.descricao}` : ''}`,
      })
      return created
    })

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    const actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

    const existing = await prisma.nonConformityActionItem.findUnique({ where: { id: actionId }, select: { id: true, nonConformityId: true } })
    if (!existing || existing.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    const row = await prisma.$transaction(async (tx) => {
      const previous = await tx.nonConformityActionItem.findUnique({
        where: { id: actionId },
        select: { id: true, descricao: true, status: true },
      })

      const updated = await tx.nonConformityActionItem.update({
      where: { id: actionId },
      data: {
        descricao: body?.descricao !== undefined ? String(body.descricao).trim() : undefined,
        responsavelId: body?.responsavelId !== undefined ? (body.responsavelId || null) : undefined,
        responsavelNome: body?.responsavelNome !== undefined ? (body.responsavelNome ? String(body.responsavelNome).trim() : null) : undefined,
        prazo: body?.prazo !== undefined ? (body.prazo ? new Date(body.prazo) : null) : undefined,
        status: Object.values(NonConformityActionStatus).includes(body?.status) ? body.status : undefined,
        evidencias: body?.evidencias !== undefined ? (body.evidencias ? String(body.evidencias).trim() : null) : undefined,
      },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message:
          previous?.status && previous.status !== updated.status
            ? `Ação ${updated.id} alterada de ${previous.status} para ${updated.status}${updated.descricao ? ` - ${updated.descricao}` : ''}`
            : `Ação ${updated.id} atualizada (${updated.status})${updated.descricao ? ` - ${updated.descricao}` : ''}`,
      })
      return updated
    })

    return NextResponse.json(row)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    const actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

    const existing = await prisma.nonConformityActionItem.findUnique({ where: { id: actionId }, select: { id: true, nonConformityId: true } })
    if (!existing || existing.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.nonConformityActionItem.delete({ where: { id: actionId } })
      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${actionId} removida do plano de ação`,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}