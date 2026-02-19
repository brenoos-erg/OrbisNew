export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

export async function GET() {
  try {
    const me = await requireActiveUser()

    const canList = await canFeature(
      me.id,
      MODULE_KEYS.MEUS_DOCUMENTOS,
      FEATURE_KEYS.MEUS_DOCUMENTOS.LISTAR,
      Action.VIEW,
    )

    if (!canList) {
      return NextResponse.json({ error: 'Sem permissão para listar documentos.' }, { status: 403 })
    }

    const rows = await prisma.documentAssignment.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      include: {
        document: {
          include: {
            solicitation: { select: { id: true, protocolo: true, titulo: true, status: true } },
            createdBy: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    })

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        signingProvider: row.signingProvider,
        signingUrl: row.signingUrl,
        signedAt: row.signedAt,
        auditTrailUrl: row.auditTrailUrl,
        auditTrailHash: row.auditTrailHash,
        document: {
          id: row.document.id,
          type: row.document.type,
          title: row.document.title,
          pdfUrl: row.document.pdfUrl,
          signedPdfUrl: row.document.signedPdfUrl,
          createdAt: row.document.createdAt,
          createdBy: row.document.createdBy,
          solicitation: row.document.solicitation,
        },
      })),
    )
  } catch (error) {
    console.error('Erro ao listar meus documentos', error)
    return NextResponse.json({ error: 'Erro ao listar documentos.' }, { status: 500 })
  }
}
