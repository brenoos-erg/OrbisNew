import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { executeControlledDocumentAction } from '@/lib/documents/controlledAction'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  try {
    const result = await executeControlledDocumentAction({ req, versionId, userId: me.id, intent: 'view' })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if ('termChallenge' in result) return NextResponse.json(result.termChallenge, { status: result.status })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Falha ao preparar visualização via pipeline único.', { versionId, error })
    return NextResponse.json(
      { error: 'Não foi possível preparar o PDF final para visualização.' },
      { status: 422 },
    )
  }
}