import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })
  const { id } = await params
  const body = await req.json()

  await prisma.$transaction([
    prisma.documentTypeApprovalFlow.deleteMany({ where: { documentTypeId: id } }),
    prisma.documentTypeCatalog.update({
      where: { id },
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
    }),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })
  const { id } = await params
  await prisma.documentTypeCatalog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}