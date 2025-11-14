import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ----------------------------------------------------
// GET /api/users/[id]/cost-centers
// Lista centros de custo vinculados ao usuário
// ----------------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const { userId } = params

  const links = await prisma.userCostCenter.findMany({
    where: { userId },
    include: {
      costCenter: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const items = links.map((l) => {
    const cc = l.costCenter
    const labelCode = cc.externalCode || cc.code || ''

    return {
      id: l.id,                 // 👈 AGORA É O ID DO VÍNCULO
      userId: l.userId,
      costCenterId: l.costCenterId,
      costCenter: {
        id: cc.id,
        description: cc.description,
        code: cc.code,
        externalCode: cc.externalCode,
      },
      label: labelCode
        ? `${labelCode} - ${cc.description}`
        : cc.description,
    }
  })

  return NextResponse.json(items)
}

// Helper pra pegar costCenterId do body OU da query string
async function getCostCenterIdFromRequest(req: Request): Promise<string | null> {
  try {
    const url = new URL(req.url)
    const fromQuery = url.searchParams.get('costCenterId')
    if (fromQuery) return fromQuery

    // se não vier na query, tenta no body
    const body = await req.json().catch(() => null as any)
    const fromBody = body?.costCenterId as string | undefined
    return fromBody || null
  } catch {
    return null
  }
}

// ----------------------------------------------------
// POST /api/users/[id]/cost-centers
// Vincula um centro de custo ao usuário
// - Atualiza user.costCenterId (centro principal)
// - Cria vínculo em UserCostCenter (sem duplicar)
// ----------------------------------------------------
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const costCenterId = await getCostCenterIdFromRequest(req)

    if (!costCenterId) {
      return NextResponse.json(
        { error: 'costCenterId é obrigatório.' },
        { status: 400 },
      )
    }

    // Garante usuário
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 },
      )
    }

    // Garante centro de custo
    const cc = await prisma.costCenter.findUnique({
      where: { id: costCenterId },
      select: { id: true, description: true, code: true, externalCode: true },
    })
    if (!cc) {
      return NextResponse.json(
        { error: 'Centro de custo não encontrado.' },
        { status: 400 },
      )
    }

    const link = await prisma.$transaction(async (tx) => {
      // centro principal do usuário
      await tx.user.update({
        where: { id },
        data: { costCenterId },
      })

      // já existe vínculo?
      const existing = await tx.userCostCenter.findFirst({
        where: { userId: id, costCenterId },
      })

      if (existing) {
        return existing
      }

      // se não existir, cria
      return tx.userCostCenter.create({
        data: {
          userId: id,
          costCenterId,
        },
      })
    })

    return NextResponse.json(link, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/users/[id]/cost-centers error', err)

    if (err?.code === 'P2003') {
      // FK inválida
      return NextResponse.json(
        { error: 'Centro de custo inválido.' },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: 'Falha ao vincular centro de custo.' },
      { status: 500 },
    )
  }
}

// ----------------------------------------------------
// DELETE /api/users/[id]/cost-centers
// Remove um vínculo { userId, costCenterId }
// ----------------------------------------------------
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const costCenterId = await getCostCenterIdFromRequest(req)

    if (!costCenterId) {
      return NextResponse.json(
        { error: 'costCenterId é obrigatório.' },
        { status: 400 },
      )
    }

    await prisma.userCostCenter.deleteMany({
      where: {
        userId: id,
        costCenterId,
      },
    })

    // opcional: se o costCenterId removido era o principal, zera o campo
    await prisma.user.updateMany({
      where: { id, costCenterId },
      data: { costCenterId: null },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/users/[id]/cost-centers error', err)
    return NextResponse.json(
      { error: 'Erro ao remover centro de custo.' },
      { status: 500 },
    )
  }
}
