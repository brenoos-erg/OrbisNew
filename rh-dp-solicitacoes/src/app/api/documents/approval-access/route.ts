import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  const stage = Number(req.nextUrl.searchParams.get('stage') ?? '0')
  if (stage !== 2 && stage !== 3) return NextResponse.json({ error: 'Stage inválido.' }, { status: 400 })

  const canApprove = await canApproveDocumentStage(me.id, stage as 2 | 3)
  return NextResponse.json({ canApprove })
}