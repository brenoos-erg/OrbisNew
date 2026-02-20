import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  })

  if (!version || version.status !== DocumentVersionStatus.PUBLICADO) {
    return NextResponse.json({ error: 'Documento publicado não encontrado.' }, { status: 404 })
  }

  const term = await prisma.documentResponsibilityTerm.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } })
  if (term) {
    const acceptance = await prisma.documentTermAcceptance.findUnique({
      where: { termId_userId: { termId: term.id, userId: me.id } },
    })
    if (!acceptance) {
      return NextResponse.json({ requiresTerm: true, term: { id: term.id, title: term.title, content: term.content } }, { status: 403 })
    }
  }

  await prisma.documentDownloadLog.create({
    data: {
      documentId: version.documentId,
      versionId,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    },
  })

  return NextResponse.json({ url: version.fileUrl })
}