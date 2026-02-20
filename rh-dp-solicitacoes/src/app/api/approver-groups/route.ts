import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()
  return NextResponse.json(await prisma.approverGroup.findMany({ include: { department: true, members: { include: { user: { select: { id: true, fullName: true } } } } }, orderBy: { name: 'asc' } }))
}

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Somente admin.' }, { status: 403 })
  const body = await req.json()
  const created = await prisma.approverGroup.create({
    data: {
      name: body.name,
      departmentId: body.departmentId ?? null,
      members: {
        create: (body.userIds ?? []).map((userId: string) => ({ userId })),
      },
    },
  })
  return NextResponse.json(created, { status: 201 })
}