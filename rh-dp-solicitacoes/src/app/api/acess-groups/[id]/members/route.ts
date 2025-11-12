import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, role } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId, groupId: params.id } },
    create: { userId, groupId: params.id, role: role || 'MEMBER' },
    update: { role: role || 'MEMBER' },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  await prisma.groupMember.delete({ where: { userId_groupId: { userId, groupId: params.id } } })
  return NextResponse.json({ ok: true })
}
