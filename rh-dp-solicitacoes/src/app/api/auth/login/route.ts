import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setAuthCookie, signSession, verifyPassword } from '@/lib/auth-local'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const identifier = String(body?.identifier ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Identificador e senha são obrigatórios.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: identifier.includes('@')
      ? { email: { equals: identifier } }
      : { login: { equals: identifier } },
    select: { id: true, passwordHash: true, status: true, mustChangePassword: true },
  })

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  if (user.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Usuário inativo.' }, { status: 403 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const res = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword })
  setAuthCookie(res, signSession(user.id))
  return res
}