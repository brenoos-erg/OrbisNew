export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { finalizeSolicitationIfNoPending } from '@/lib/signature/finalizeSolicitationIfNoPending'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
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

    const assignment = await prisma.documentAssignment.findFirst({
      where: { id: (await params).assignmentId, userId: me.id },
      include: {
        document: { select: { id: true, solicitationId: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    if (assignment.signingProvider === 'DOCUSIGN' && process.env.ALLOW_INTERNAL_SIGNATURE !== 'true') {
      return NextResponse.json(
        {
          error: 'Assinatura deve ser realizada via DocuSign',
          signingUrl: assignment.signingUrl,
        },
        { status: 400 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const signed = await tx.documentAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'ASSINADO',
          signedAt: new Date(),
        },
      })

      if (assignment.document.solicitationId) {
        await finalizeSolicitationIfNoPending(
          tx,
          assignment.document.solicitationId,
          'assinatura-interna',
        )
      }

      return signed
    })

    return NextResponse.json({ assignment: updated })
  } catch (error) {
    console.error('Erro ao assinar documento', error)
    return NextResponse.json({ error: 'Erro ao assinar documento.', detail: devErrorDetail(error) }, { status: 500 })
  }
}