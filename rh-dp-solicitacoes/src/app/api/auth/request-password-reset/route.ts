import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findUserByIdentifier, normalizeIdentifier } from '@/lib/auth-identifier'
import { resolveAppBaseUrl } from '@/lib/site-url'
import { sendMail } from '@/lib/mailer'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const identifier = normalizeIdentifier(body?.identifier)
  const next = String(body?.next ?? '/dashboard')
  if (!identifier) return NextResponse.json({ ok: true, message: 'Se o usuário existir, enviaremos instruções por e-mail.' })

  const user = await findUserByIdentifier(identifier)

  if (!user) return NextResponse.json({ ok: true, message: 'Se o usuário existir, enviaremos instruções por e-mail.' })

  const baseUrl = resolveAppBaseUrl({ context: 'request-password-reset' })
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: true, message: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' })
  }


  const token = randomBytes(24).toString('hex')
  const resetLink = `${baseUrl}/primeiro-acesso?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: tokenHash(token),
      resetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  })

  await sendMail(
    {
      to: [user.email],
      subject: 'Definição de senha - Primeiro acesso',
      text: `Olá! Para criar ou redefinir sua senha, acesse: ${resetLink}`,
      html: `<p>Olá!</p><p>Para criar ou redefinir sua senha, clique no link abaixo:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Este link expira em 30 minutos.</p>`,
    },
    'SYSTEM',
  )

  if (process.env.NODE_ENV !== 'production') {
    console.info('[request-password-reset] token', { email: user.email, token })
  }

  return NextResponse.json({ ok: true, message: 'Se o usuário existir, enviaremos instruções por e-mail.' })
}
