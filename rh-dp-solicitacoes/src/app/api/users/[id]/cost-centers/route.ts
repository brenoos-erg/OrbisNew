// src/app/api/users/[id]/cost-centers/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/users/:id/cost-centers  -> lista vínculos do usuário
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rows = await prisma.userCostCenter.findMany({
    where: { userId: id },
    select: {
      id: true,
      userId: true,
      costCenterId: true,
      costCenter: { select: { id: true, description: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST /api/users/:id/cost-centers  -> cria vínculo
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { costCenterId } = await req.json()

  if (!costCenterId) {
    return NextResponse.json({ error: 'costCenterId é obrigatório' }, { status: 400 })
  }

  // impede duplicidade
  const exists = await prisma.userCostCenter.findFirst({
    where: { userId: id, costCenterId },
    select: { id: true },
  })
  if (exists) {
    return NextResponse.json({ error: 'Vínculo já existe' }, { status: 409 })
  }

  const link = await prisma.userCostCenter.create({
    data: { userId: id, costCenterId },
    select: {
      id: true,
      userId: true,
      costCenterId: true,
      costCenter: { select: { id: true, description: true } },
    },
  })

  return NextResponse.json(link, { status: 201 })
}
