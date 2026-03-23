import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isAdmin(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (!isAdmin(me.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { id } = await params

  const updated = await prisma.documentApprovalControl.update({
    where: { id },
    data: {
      canApproveTab2: typeof body?.canApproveTab2 === 'boolean' ? body.canApproveTab2 : undefined,
      canApproveTab3: typeof body?.canApproveTab3 === 'boolean' ? body.canApproveTab3 : undefined,
      active: typeof body?.active === 'boolean' ? body.active : undefined,
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  if (!isAdmin(me.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params
  await prisma.documentApprovalControl.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}