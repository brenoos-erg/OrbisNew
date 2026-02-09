export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
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
    const { assignmentId, provider = 'EXTERNAL_PROVIDER' } = body as {
      assignmentId?: string
      provider?: string
    }

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId é obrigatório.' }, { status: 400 })
    }

    const assignment = await prisma.documentAssignment.findFirst({
      where: { id: assignmentId, documentId: params.id, userId: me.id },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Atribuição de documento não encontrada.' }, { status: 404 })
    }

    const signingUrl = `/dashboard/meus-documentos?assinar=${assignment.id}`

    const updated = await prisma.documentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: 'AGUARDANDO_ASSINATURA',
        signingProvider: String(provider),
        signingUrl,
      },
    })

    return NextResponse.json({ assignment: updated, signingUrl })
  } catch (error) {
    console.error('Erro ao solicitar assinatura', error)
    return NextResponse.json({ error: 'Erro ao solicitar assinatura.' }, { status: 500 })
  }
}
