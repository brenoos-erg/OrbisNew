import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeControlledDocumentAction } from '@/lib/documents/controlledAction'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, status: true },
  })

  if (!version || version.status !== DocumentVersionStatus.PUBLICADO) {
    return NextResponse.json({ error: 'Documento publicado não encontrado.' }, { status: 404 })
  }

  try {
    const result = await executeControlledDocumentAction({
      req,
      versionId,
      userId: me.id,
      intent: 'download',
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if ('termChallenge' in result) return NextResponse.json(result.termChallenge, { status: result.status })

    return NextResponse.json({ url: result.downloadUrl })
  } catch (error) {
    console.error('Falha ao preparar download de aprovação via pipeline central.', { versionId, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final para download.' }, { status: 422 })
  }
}