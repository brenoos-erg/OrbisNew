import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments } from '@/lib/documentApprovalControl'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  const stage = Number(req.nextUrl.searchParams.get('stage') ?? '0')
  if (stage !== 2 && stage !== 3) return NextResponse.json({ error: 'Stage inválido.' }, { status: 400 })

  const canApprove =
    stage === 2
      ? await canAccessApprovalDocuments(me.id, me.role)
      : await canAccessQualityReviewDocuments(me.id, me.role)

  return NextResponse.json({ canApprove })
}