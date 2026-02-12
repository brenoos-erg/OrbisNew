import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth-local'

export async function POST(req: Request) {
  const me = await requireActiveUser()
  const body = await req.json().catch(() => null)
  const currentPassword = String(body?.currentPassword ?? '')
  const newPassword = String(body?.newPassword ?? '')

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'A nova senha deve ter ao menos 6 caracteres.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } })
  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Senha ainda não configurada para este usuário.' }, { status: 400 })
  }

  if (!me.mustChangePassword) {
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Senha atual inválida.' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  })

  return NextResponse.json({ ok: true })
}