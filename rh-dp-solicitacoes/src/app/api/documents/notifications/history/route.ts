import { Action } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getNotificationsCenterData, requireNotificationAdmin } from '@/lib/documents/documentNotificationsCenter'

export async function GET(req: NextRequest) {
  try {
    await requireNotificationAdmin(Action.VIEW)
  } catch {
    return NextResponse.json({ error: 'Sem permissão para visualizar histórico.' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const data = await getNotificationsCenterData({
    event: params.get('event')?.trim() || '',
    status: params.get('status')?.trim() || '',
    documentTypeId: params.get('documentTypeId')?.trim() || '',
  })
  return NextResponse.json({ history: data.history, summary: data.summary })
}
