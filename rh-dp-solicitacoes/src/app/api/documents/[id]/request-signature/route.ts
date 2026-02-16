export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { createEmbeddedSigningForAssignment } from '@/lib/signature/docusignAssignment'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()

    const canSign = await canFeature(
      me.id,
      MODULE_KEYS.MEUS_DOCUMENTOS,
      FEATURE_KEYS.MEUS_DOCUMENTOS.ASSINAR,
      Action.VIEW,
    )

    if (!canSign) {
      return NextResponse.json({ error: 'Sem permissão para assinar documentos.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { assignmentId } = body as { assignmentId?: string }

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId é obrigatório.' }, { status: 400 })
    }

    const assignment = await prisma.documentAssignment.findFirst({
      where: { id: assignmentId, documentId: (await params).id, userId: me.id },
      include: {
        user: { select: { fullName: true, email: true } },
        document: { select: { title: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Atribuição de documento não encontrada.' }, { status: 404 })
    }

    if (
      assignment.signingProvider === 'DOCUSIGN' &&
      assignment.signingUrl &&
      assignment.status === 'AGUARDANDO_ASSINATURA'
    ) {
      return NextResponse.json({ assignment, signingUrl: assignment.signingUrl })
    }

    const session = await createEmbeddedSigningForAssignment({
      assignmentId: assignment.id,
      signerName: assignment.user.fullName,
      signerEmail: assignment.user.email,
      fileName: assignment.document.title,
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Erro ao solicitar assinatura', error)
    return NextResponse.json({ error: 'Erro ao solicitar assinatura.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
