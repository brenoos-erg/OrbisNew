import { NextRequest, NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { executeControlledDocumentAction, type ControlledIntent } from '@/lib/documents/controlledAction'

type Payload = { intent?: string }

function normalizeIntent(intent?: string): ControlledIntent | null {
  const value = String(intent ?? '').trim().toLowerCase()
  if (value === 'view' || value === 'download' || value === 'print') return value
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const payload = (await req.json().catch(() => null)) as Payload | null
  const intent = normalizeIntent(payload?.intent)

  if (!intent) {
    return NextResponse.json({ error: 'Ação inválida. Use view, download ou print.' }, { status: 400 })
  }

  try {
    const result = await executeControlledDocumentAction({ req, versionId, userId: me.id, intent })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if ('termChallenge' in result) return NextResponse.json(result.termChallenge, { status: result.status })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Falha ao executar ação no pipeline único de PDF controlado.', { versionId, intent, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final do documento.' }, { status: 422 })
  }
}