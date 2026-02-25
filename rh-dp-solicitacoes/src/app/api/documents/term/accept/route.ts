import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  const body = await req.json().catch(() => null)
  const termId = typeof body?.termId === 'string' ? body.termId : ''

  if (!termId) {
    return NextResponse.json({ error: 'termId é obrigatório.' }, { status: 400 })
  }

  const activeTerm = await prisma.documentResponsibilityTerm.findFirst({
    where: { id: termId, active: true },
    select: { id: true },
  })

  if (!activeTerm) {
    return NextResponse.json({ error: 'Termo ativo não encontrado.' }, { status: 404 })
  }

  const acceptance = await prisma.documentTermAcceptance.upsert({
    where: { termId_userId: { termId, userId: me.id } },
    create: {
      termId,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    },
    update: {
      acceptedAt: new Date(),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    },
    select: { id: true, acceptedAt: true },
  })

  return NextResponse.json({ ok: true, acceptance })
}