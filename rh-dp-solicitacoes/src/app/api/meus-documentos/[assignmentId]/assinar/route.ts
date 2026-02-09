export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

export async function POST(
  _req: Request,
  { params }: { params: { assignmentId: string } },
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
      where: { id: params.assignmentId, userId: me.id },
      include: {
        document: { select: { id: true, solicitationId: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    const updated = await prisma.documentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: 'ASSINADO',
        signedAt: new Date(),
      },
    })

    if (assignment.document.solicitationId) {
      const pending = await prisma.documentAssignment.count({
        where: {
          document: { solicitationId: assignment.document.solicitationId },
          status: { in: ['PENDENTE', 'AGUARDANDO_ASSINATURA'] },
        },
      })

      if (pending === 0) {
        await prisma.solicitation.update({
          where: { id: assignment.document.solicitationId },
          data: {
            status: 'CONCLUIDA',
            dataFechamento: new Date(),
          },
        })

        await prisma.solicitationTimeline.create({
          data: {
            solicitationId: assignment.document.solicitationId,
            status: 'CONCLUIDA',
            message: 'Solicitação concluída após assinatura do termo.',
          },
        })
      }
    }

    return NextResponse.json({ assignment: updated })
  } catch (error) {
    console.error('Erro ao assinar documento', error)
    return NextResponse.json({ error: 'Erro ao assinar documento.' }, { status: 500 })
  }
}