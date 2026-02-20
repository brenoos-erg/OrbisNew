import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()
  const rows = await prisma.documentTypeCatalog.findMany({
    include: {
      approvalFlowItems: {
        include: { approverGroup: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })

  const body = await req.json()
  const created = await prisma.documentTypeCatalog.create({
    data: {
      code: body.code,
      description: body.description,
      controlledCopy: !!body.controlledCopy,
      linkCostCenterArea: !!body.linkCostCenterArea,
      approvalFlowItems: {
        create: (body.approvalFlowItems ?? []).map((item: any, idx: number) => ({
          order: Number(item.order ?? idx + 1),
          stepType: item.stepType,
          approverGroupId: item.approverGroupId,
          active: item.active ?? true,
        })),
      },
    },
    include: { approvalFlowItems: true },
  })

  return NextResponse.json(created, { status: 201 })
}