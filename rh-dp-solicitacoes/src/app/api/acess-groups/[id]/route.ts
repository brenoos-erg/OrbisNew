export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'


export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const group = await prisma.accessGroup.findUnique({
    where: { id: (await params).id },
    include: {
      members: { include: { user: { select: { id: true, fullName: true, email: true, login: true } } } },
      grants: { include: { module: true } },
    },
  })
  if (!group) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  return NextResponse.json(group)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { name, notes } = await req.json()
  const group = await prisma.accessGroup.update({ where: { id: (await params).id }, data: { name, notes } })
  return NextResponse.json(group)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await prisma.accessGroup.delete({ where: { id: (await params).id } })
  return NextResponse.json({ ok: true })
}