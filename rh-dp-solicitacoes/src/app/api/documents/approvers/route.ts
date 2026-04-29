import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isAdmin(role?: string | null) {
  return role === 'ADMIN'
}

export async function GET() {
  const me = await requireActiveUser()
  if (!isAdmin(me.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const [items, users] = await Promise.all([
    prisma.documentApprovalControl.findMany({
      orderBy: { user: { fullName: 'asc' } },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true } }),
  ])

  return NextResponse.json({ items, users })
}

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  if (!isAdmin(me.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.userId) return NextResponse.json({ error: 'Usuário é obrigatório.' }, { status: 400 })

  const created = await prisma.documentApprovalControl.create({
    data: {
      userId: body.userId,
      canApproveTab2: Boolean(body.canApproveTab2),
      canApproveTab3: Boolean(body.canApproveTab3),
      active: body.active ?? true,
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  })

  return NextResponse.json(created, { status: 201 })
}