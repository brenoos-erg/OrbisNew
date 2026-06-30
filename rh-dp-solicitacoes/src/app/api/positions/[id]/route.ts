export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { positionDataFromBody, positionSelect, withCurrentDocument } from '../positionFields'
import { attachPreviewedPositionDocument } from '@/lib/positions/positionDocumentStorage'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const id = (await params).id
    const body = await request.json()
    await prisma.position.update({ where: { id }, data: positionDataFromBody(body), select: positionSelect })

    if (body.tempFileToken) {
      const me = await requireActiveUser()
      await attachPreviewedPositionDocument({
        prisma,
        positionId: id,
        uploadedById: me.id,
        tempFileToken: body.tempFileToken,
        originalFilename: body.documentOriginalFilename ?? 'documento-cargo',
        mimeType: body.documentMimeType ?? null,
        sizeBytes: body.documentSizeBytes ?? null,
        parsedText: body.parsedText ?? null,
        extracted: body.extractedDocument ?? null,
      })
    }

    const updated = await prisma.position.findUniqueOrThrow({ where: { id }, select: positionSelect })
    return NextResponse.json(withCurrentDocument(updated))
  } catch (e) {
    console.error('PATCH /api/positions/[id] error', e)
    return NextResponse.json({ error: 'Erro ao atualizar cargo' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const id = (await params).id
    const usersCount = await prisma.user.count({ where: { positionId: id } })
    const solicitationsCount = await prisma.solicitation.count({
      where: {
        OR: [
          { payload: { path: '$.campos.cargoId', equals: id } },
          { payload: { path: '$.campos.cargoSnapshot.positionId', equals: id } },
        ],
      } as any,
    })
    if (usersCount > 0 || solicitationsCount > 0) {
      await prisma.position.update({ where: { id }, data: { active: false } })
      return NextResponse.json({ ok: true, softDeleted: true })
    }
    await prisma.position.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/positions/[id] error', e)
    return NextResponse.json({ error: 'Erro ao excluir cargo' }, { status: 500 })
  }
}
