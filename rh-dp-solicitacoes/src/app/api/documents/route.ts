import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const body = await req.json()

    const created = await prisma.isoDocument.create({
      data: {
        code: body.code,
        title: body.title,
        documentTypeId: body.documentTypeId,
        ownerDepartmentId: body.ownerDepartmentId,
        authorUserId: body.authorUserId ?? me.id,
        physicalLocation: body.physicalLocation,
        accessType: body.accessType ?? 'INTERNO',
        validityAt: body.validityAt ? new Date(body.validityAt) : null,
        summary: body.summary,
        affectedAreasNotes: body.affectedAreasNotes,
        versions: {
          create: {
            revisionNumber: body.revisionNumber ?? 1,
            status: DocumentVersionStatus.EM_ELABORACAO,
            fileUrl: body.fileUrl ?? null,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            nextReviewAt: body.nextReviewAt ? new Date(body.nextReviewAt) : null,
          },
        },
      },
      include: { versions: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar documento ISO', error)
    return NextResponse.json({ error: 'Erro ao criar documento.' }, { status: 500 })
  }
}