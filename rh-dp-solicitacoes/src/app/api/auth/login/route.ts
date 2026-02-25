import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSecureRequest, setAuthCookie, signSession, verifyPassword } from '@/lib/auth-local'
import { findUserByIdentifier, normalizeIdentifier } from '@/lib/auth-identifier'


export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const identifier = normalizeIdentifier(body?.identifier)
  const password = String(body?.password ?? '')

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Identificador e senha são obrigatórios.' }, { status: 400 })
  }

  const user = await findUserByIdentifier(identifier)

  if (process.env.NODE_ENV !== 'production') {
    console.info('[auth/login] lookup', {
      identifier,
      userFound: !!user,
      passwordHashExists: !!user?.passwordHash,
      mustChangePassword: !!user?.mustChangePassword,
    })
  }

  if (!user) {
     return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'NO_PASSWORD',
        mustChangePassword: true,
        error: 'Usuário ainda não possui senha cadastrada.',
      },
      { status: 428 },
    )
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  if (user.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Usuário inativo.' }, { status: 403 })
  }

   await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const secure = isSecureRequest(req)
  const res = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword })
  setAuthCookie(res, signSession(user.id), secure)
  return res
}