import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  await prisma.$transaction([
    prisma.approverGroupMember.deleteMany({ where: { groupId: id } }),
    prisma.approverGroup.update({
      where: { id },
      data: {
        name: body.name,
        departmentId: body.departmentId ?? null,
        members: { create: (body.userIds ?? []).map((userId: string) => ({ userId })) },
      },
    }),
  ])
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })
  const { id } = await params
  await prisma.approverGroup.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}