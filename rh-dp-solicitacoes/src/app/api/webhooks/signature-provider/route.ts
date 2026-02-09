export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const {
      assignmentId,
      signed,
      signedAt,
      auditTrailUrl,
      auditTrailHash,
    } = body as {
      assignmentId?: string
      signed?: boolean
      signedAt?: string
      auditTrailUrl?: string
      auditTrailHash?: string
    }

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId é obrigatório.' }, { status: 400 })
    }

    const updated = await prisma.documentAssignment.update({
      where: { id: assignmentId },
      data: {
        status: signed ? 'ASSINADO' : 'RECUSADO',
        signedAt: signed ? (signedAt ? new Date(signedAt) : new Date()) : null,
        auditTrailUrl: auditTrailUrl ?? null,
        auditTrailHash: auditTrailHash ?? null,
      },
      include: {
        document: { select: { solicitationId: true } },
      },
    })

    if (signed && updated.document.solicitationId) {
      const pending = await prisma.documentAssignment.count({
        where: {
          document: { solicitationId: updated.document.solicitationId },
          status: { in: ['PENDENTE', 'AGUARDANDO_ASSINATURA'] },
        },
      })

      if (pending === 0) {
        await prisma.solicitation.update({
          where: { id: updated.document.solicitationId },
          data: { status: 'CONCLUIDA', dataFechamento: new Date() },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro no webhook de assinatura', error)
    return NextResponse.json({ error: 'Erro ao processar webhook.' }, { status: 500 })
  }
}