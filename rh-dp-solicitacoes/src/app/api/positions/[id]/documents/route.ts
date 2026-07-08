export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { Action } from '@prisma/client'
import { canAccessRhPositions } from '@/lib/rhPositionsAccess'
import { attachPreviewedPositionDocument, createPositionDocumentPreview } from '@/lib/positions/positionDocumentStorage'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const me = await requireActiveUser()
  if (!(await canAccessRhPositions(me, Action.VIEW))) {
    return NextResponse.json({ error: 'Acesso restrito ao departamento de Recursos Humanos.' }, { status: 403 })
  }
  const documents = await prisma.positionDocument.findMany({ where: { positionId: (await params).id }, orderBy: { uploadedAt: 'desc' }, select: { id: true, originalFilename: true, fileUrl: true, mimeType: true, sizeBytes: true, uploadedAt: true, indexador: true, revision: true, documentDate: true, isCurrent: true } })
  return NextResponse.json({ items: documents })
}

export async function POST(request: Request, { params }: Params) {
  try {
    const me = await requireActiveUser()
    if (!(await canAccessRhPositions(me, Action.CREATE))) return NextResponse.json({ error: 'Somente usuários do RH podem anexar documentos de cargo.' }, { status: 403 })
    const positionId = (await params).id
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })

    const preview = await createPositionDocumentPreview(file)
    const document = await attachPreviewedPositionDocument({
      prisma,
      positionId,
      uploadedById: me.id,
      tempFileToken: preview.tempFileToken,
      originalFilename: preview.originalFilename,
      mimeType: preview.mimeType,
      sizeBytes: preview.sizeBytes,
      parsedText: preview.parsedText,
      extracted: preview.extracted,
    })

    return NextResponse.json({ document, parsedText: preview.parsedText, extracted: preview.extracted })
  } catch (error) {
    console.error('POST /api/positions/[id]/documents error', error)
    const message = error instanceof Error ? error.message : 'Erro ao anexar documento do cargo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
