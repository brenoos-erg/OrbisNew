import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireNotificationAdmin, upsertNotificationRule } from '@/lib/documents/documentNotificationsCenter'

export async function POST(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para criar regras.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as any
  try {
    const rule = await upsertNotificationRule(body)
    return NextResponse.json({ ok: true, rule }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar regra.' }, { status: 400 })
  }
}
