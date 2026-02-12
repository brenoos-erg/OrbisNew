import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const identifier = String(body?.identifier ?? '').trim().toLowerCase()
  if (!identifier) return NextResponse.json({ ok: true })

  const user = await prisma.user.findFirst({
    where: identifier.includes('@')
      ? { email: { equals: identifier } }
      : { login: { equals: identifier } },
    select: { id: true, email: true },
  })

  if (!user) return NextResponse.json({ ok: true })

  const token = randomBytes(24).toString('hex')
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: tokenHash(token),
      resetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  })

  if (process.env.NODE_ENV !== 'production') {
    console.info('[request-password-reset] token', { email: user.email, token })
  }

  return NextResponse.json({ ok: true })
}