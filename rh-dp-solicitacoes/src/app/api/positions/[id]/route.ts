export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Action } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getPrismaP2000Message, getPrismaP2002Message, positionDataFromBody, positionSelect, withCurrentDocument } from '../positionFields'
import { attachPreviewedPositionDocument } from '@/lib/positions/positionDocumentStorage'
import { canAccessRhPositions } from '@/lib/rhPositionsAccess'

type Params = { params: Promise<{ id: string }> }

function unauthorizedResponse(error: unknown) {
  if ((error as Error)?.message === 'Usuário não autenticado') {
    return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
  }
  return null
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireActiveUser()
    if (!(await canAccessRhPositions(user, Action.VIEW))) {
      return NextResponse.json({ error: 'Sem permissão para visualizar cargos.' }, { status: 403 })
    }

    const id = (await params).id
    const position = await prisma.position.findUniqueOrThrow({ where: { id }, select: positionSelect })
    return NextResponse.json(withCurrentDocument(position))
  } catch (e) {
    const unauthorized = unauthorizedResponse(e)
    if (unauthorized) return unauthorized
    console.error('GET /api/positions/[id] error', e)
    return NextResponse.json({ error: 'Erro ao buscar cargo' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireActiveUser()
    if (!(await canAccessRhPositions(user, Action.UPDATE))) {
      return NextResponse.json({ error: 'Sem permissão para atualizar cargos.' }, { status: 403 })
    }

    const id = (await params).id
    const body = await request.json()
    await prisma.position.update({ where: { id }, data: positionDataFromBody(body), select: positionSelect })

    if (body.tempFileToken) {
      await attachPreviewedPositionDocument({
        prisma,
        positionId: id,
        uploadedById: user.id,
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
    const p2000Message = getPrismaP2000Message(e)
    if (p2000Message) return NextResponse.json({ error: p2000Message }, { status: 400 })
    const p2002Message = getPrismaP2002Message(e)
    if (p2002Message) return NextResponse.json({ error: p2002Message }, { status: 400 })
    if ((e as Error)?.message === 'Data do documento inválida.') return NextResponse.json({ error: 'Data do documento inválida.' }, { status: 400 })
    const unauthorized = unauthorizedResponse(e)
    if (unauthorized) return unauthorized
    console.error('PATCH /api/positions/[id] error', e)
    return NextResponse.json({ error: 'Erro ao atualizar cargo' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireActiveUser()
    if (!(await canAccessRhPositions(user, Action.DELETE))) {
      return NextResponse.json({ error: 'Sem permissão para excluir cargos.' }, { status: 403 })
    }

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
    const unauthorized = unauthorizedResponse(e)
    if (unauthorized) return unauthorized
    console.error('DELETE /api/positions/[id] error', e)
    return NextResponse.json({ error: 'Erro ao excluir cargo' }, { status: 500 })
  }
}
