import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users/:id/cost-centers
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id
  try {
    const rows = await prisma.userCostCenter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        costCenter: { select: { id: true, description: true } },
      },
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET user cost-centers error', e)
    return NextResponse.json({ error: 'Erro ao carregar vínculos.' }, { status: 500 })
  }
}

// POST /api/users/:id/cost-centers
// body: { costCenterId: string }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id
  const { costCenterId } = await req.json().catch(() => ({}))
  if (!costCenterId) {
    return NextResponse.json({ error: 'costCenterId é obrigatório.' }, { status: 400 })
  }

  try {
    // garanta que tenha um índice único em [userId, costCenterId] no Prisma:
    // @@unique([userId, costCenterId])
    const link = await prisma.userCostCenter.upsert({
      where: { userId_costCenterId: { userId, costCenterId } },
      create: { userId, costCenterId },
      update: {},
      include: {
        costCenter: { select: { id: true, description: true } },
      },
    })
    return NextResponse.json(link, { status: 201 })
  } catch (e) {
    console.error('POST user cost-centers error', e)
    return NextResponse.json({ error: 'Falha ao criar vínculo.' }, { status: 500 })
  }
}
