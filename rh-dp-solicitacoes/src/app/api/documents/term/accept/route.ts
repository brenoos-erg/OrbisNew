import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  const body = await req.json().catch(() => null)
  const termId = typeof body?.termId === 'string' ? body.termId : ''
  const versionId = typeof body?.versionId === 'string' ? body.versionId : ''
  const intentRaw = typeof body?.intent === 'string' ? body.intent.trim().toUpperCase() : ''
  const allowedIntents = new Set(['VIEW', 'DOWNLOAD', 'PRINT'])

  if (!termId || !versionId || !allowedIntents.has(intentRaw)) {
    return NextResponse.json({ error: 'termId, versionId e intent (VIEW|DOWNLOAD|PRINT) são obrigatórios.' }, { status: 400 })
  }

  const activeTerm = await prisma.documentResponsibilityTerm.findFirst({
    where: { id: termId, active: true },
    select: { id: true },
  })

  if (!activeTerm) {
    return NextResponse.json({ error: 'Termo ativo não encontrado.' }, { status: 404 })
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true },
  })
  if (!version) {
    return NextResponse.json({ error: 'Versão de documento não encontrada.' }, { status: 404 })
  }

  const [acceptance, actionAcceptance] = await prisma.$transaction([
    prisma.documentTermAcceptance.upsert({
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
    }),
    prisma.documentTermActionAcceptance.upsert({
      where: {
        termId_userId_versionId_intent: {
          termId,
          userId: me.id,
          versionId,
          intent: intentRaw,
        },
      },
      create: {
        termId,
        userId: me.id,
        versionId,
        intent: intentRaw,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent'),
      },
      update: {
        acceptedAt: new Date(),
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent'),
      },
      select: { id: true, acceptedAt: true, intent: true, versionId: true },
    }),
  ])
   return NextResponse.json({ ok: true, acceptance, actionAcceptance })
}