import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveTermChallenge } from '@/lib/documentTermAccess'

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

  const termChallenge = await resolveTermChallenge(prisma, me.id)
  if (termChallenge) {
    return NextResponse.json(termChallenge, { status: 403 })
  }

  const resolvedFileUrl = version.fileUrl || (await prisma.documentVersion.findFirst({ where: { documentId: version.documentId, isCurrentPublished: true, fileUrl: { not: null } }, orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }], select: { fileUrl: true } }))?.fileUrl
  if (!resolvedFileUrl) return NextResponse.json({ error: 'Arquivo publicado não encontrado.' }, { status: 404 })

  await prisma.documentDownloadLog.create({
    data: {
      documentId: version.documentId,
      versionId,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    },
  })

  return NextResponse.json({ url: resolvedFileUrl })
}