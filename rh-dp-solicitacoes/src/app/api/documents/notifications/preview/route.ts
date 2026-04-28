import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { previewNotification, requireNotificationAdmin } from '@/lib/documents/documentNotificationsCenter'

export async function POST(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.VIEW)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para visualizar prévia.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as any
  const preview = await previewNotification(body)
  return NextResponse.json(preview)
}
