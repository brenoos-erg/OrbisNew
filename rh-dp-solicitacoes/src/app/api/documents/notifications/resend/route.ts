import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireNotificationAdmin, resendNotification } from '@/lib/documents/documentNotificationsCenter'

export async function POST(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para reenvio.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as any
  try {
    const response = await resendNotification(body)
    return NextResponse.json(response, { status: response.ok ? 200 : 500 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao reenviar.' }, { status: 400 })
  }
}
