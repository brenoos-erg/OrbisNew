import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireNotificationAdmin, testNotification } from '@/lib/documents/documentNotificationsCenter'

export async function POST(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.UPDATE)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para envio de teste.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as any
  const response = await testNotification(body)
  return NextResponse.json(response, { status: response.ok ? 200 : 500 })
}
