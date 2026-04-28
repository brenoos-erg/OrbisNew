import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import {
  getNotificationsCenterData,
  previewNotification,
  requireNotificationAdmin,
  testNotification,
  upsertNotificationRule,
} from '@/lib/documents/documentNotificationsCenter'

export async function GET(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.VIEW)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para visualizar a central de notificações.' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const payload = await getNotificationsCenterData({
    event: params.get('event')?.trim() || '',
    status: params.get('status')?.trim() || '',
    documentTypeId: params.get('documentTypeId')?.trim() || '',
  })
  return NextResponse.json({ canEdit: true, ...payload })
}

export async function PATCH(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para editar notificações.' }, { status: 403 })
  }
  const body = (await req.json().catch(() => null)) as any
  try {
    const rule = await upsertNotificationRule(body)
    return NextResponse.json({ ok: true, rule })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar regra.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para envio de teste.' }, { status: 403 })
  }
  const body = (await req.json().catch(() => null)) as any
  if (body?.mode === 'preview') {
    const preview = await previewNotification(body)
    return NextResponse.json(preview)
  }
  if (body?.mode === 'test') {
    const response = await testNotification(body)
    return NextResponse.json(response, { status: response.ok ? 200 : 500 })
  }
  return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
}
