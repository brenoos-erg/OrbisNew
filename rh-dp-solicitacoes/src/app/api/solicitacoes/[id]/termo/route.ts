export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id
    const body = await req.json().catch(() => ({}))

    const {
      userId,
      title,
      pdfUrl,
      signingProvider,
      signingUrl,
    } = body as {
      userId?: string
      title?: string
      pdfUrl?: string
      signingProvider?: string
      signingUrl?: string
    }

    if (!userId || !pdfUrl) {
      return NextResponse.json(
        { error: 'userId e pdfUrl são obrigatórios.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      select: { id: true, protocolo: true, status: true },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    const document = await prisma.document.create({
      data: {
        solicitationId,
        type: 'TERMO_RESPONSABILIDADE',
        title: title?.trim() || `Termo de responsabilidade - ${solicitation.protocolo}`,
        pdfUrl: String(pdfUrl).trim(),
        createdById: me.id,
        assignments: {
          create: {
            userId: String(userId),
            status: signingUrl ? 'AGUARDANDO_ASSINATURA' : 'PENDENTE',
            signingProvider: signingProvider ? String(signingProvider) : null,
            signingUrl: signingUrl ? String(signingUrl) : null,
          },
        },
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    })

    await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        status: 'AGUARDANDO_TERMO',
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'AGUARDANDO_TERMO',
        message: 'Termo de responsabilidade gerado e pendente de assinatura.',
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'TERMO_GERADO',
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Erro ao gerar termo da solicitação', error)
    return NextResponse.json(
      { error: 'Erro ao gerar termo da solicitação.' },
      { status: 500 },
    )
  }
}
