// src/app/api/users/[id]/cost-centers/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string; linkId?: string } }

// Lista vínculos do usuário
export async function GET(_req: Request, { params }: Params) {
  const links = await prisma.userCostCenter.findMany({
    where: { userId: params.id },
    include: { costCenter: { select: { id: true, description: true } } },
  })

  return NextResponse.json(links)
}

// Cria vínculo
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = params
    const { costCenterId } = await req.json()

    const link = await prisma.userCostCenter.create({
      data: {
        userId: id,
        costCenterId,
      },
      include: {
        costCenter: { select: { id: true, description: true } },
      },
    })

    return NextResponse.json(link, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Erro ao vincular centro de custo.' },
      { status: 500 },
    )
  }
}

// Remove vínculo: DELETE /api/users/:id/cost-centers/:linkId
export async function DELETE(_req: Request, { params }: { params: { id: string; linkId: string } }) {
  try {
    await prisma.userCostCenter.delete({
      where: { id: params.linkId },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Erro ao remover vínculo.' },
      { status: 500 },
    )
  }
}
