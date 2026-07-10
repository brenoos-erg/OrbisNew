import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { requireQualityDocumentManager } from '@/lib/documents/documentManagementAccess'

export async function GET() {
  const me = await requireActiveUser()
  const access = await requireQualityDocumentManager(me.id)

  return NextResponse.json(access)
}
