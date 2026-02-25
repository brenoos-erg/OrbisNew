import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, setAuthCookie, signSession } from '@/lib/auth-local'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = String(body?.token ?? '').trim()
  const password = String(body?.password ?? '')

  if (!token || password.length < 6) {
    return NextResponse.json({ error: 'Token e senha válida são obrigatórios.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: tokenHash(token),
      resetTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  })

  if (!user) return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      lastLoginAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  })

  const res = NextResponse.json({ ok: true })
  setAuthCookie(res, signSession(user.id))
  return res
}