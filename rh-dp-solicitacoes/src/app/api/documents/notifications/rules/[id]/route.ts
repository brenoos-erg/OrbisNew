import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireNotificationAdmin, upsertNotificationRule } from '@/lib/documents/documentNotificationsCenter'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para editar regras.' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => null)) as any

  try {
    const rule = await upsertNotificationRule({ ...body, id })
    return NextResponse.json({ ok: true, rule })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar regra.' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireNotificationAdmin(Action.DELETE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para excluir regras.' }, { status: 403 })
  }

  const { id } = await params
  await prisma.documentNotificationRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
