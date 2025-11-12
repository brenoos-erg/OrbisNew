import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const groups = await prisma.accessGroup.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, notes: true, _count: { select: { members: true, grants: true } } },
  })
  return NextResponse.json(groups)
}

export async function POST(req: Request) {
  const { name, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  const group = await prisma.accessGroup.create({ data: { name: name.trim(), notes: notes?.trim() || null } })
  return NextResponse.json(group, { status: 201 })
}
