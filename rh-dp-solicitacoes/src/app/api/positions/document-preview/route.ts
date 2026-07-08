export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { Action } from '@prisma/client'
import { canAccessRhPositions } from '@/lib/rhPositionsAccess'
import { createPositionDocumentPreview } from '@/lib/positions/positionDocumentStorage'

export async function POST(request: Request) {
  try {
    const me = await requireActiveUser()
    if (!(await canAccessRhPositions(me, Action.CREATE))) {
      return NextResponse.json({ error: 'Somente usuários do RH podem importar documentos de cargo.' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })

    const preview = await createPositionDocumentPreview(file)
    return NextResponse.json(preview)
  } catch (error) {
    console.error('POST /api/positions/document-preview error', error)
    const message = error instanceof Error ? error.message : 'Erro ao pré-processar documento do cargo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
