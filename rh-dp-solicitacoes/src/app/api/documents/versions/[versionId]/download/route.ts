import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveTermChallenge } from '@/lib/documentTermAccess'
import { registerDocumentAuditLog } from '@/lib/documentAudit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: true,
      distributions: { orderBy: { createdAt: 'desc' }, take: 1, select: { versionId: true } },
    },
  })

  if (!version) {
    return NextResponse.json({ error: 'Versão do documento não encontrada.' }, { status: 404 })
  }

  const [moduleAccess, departmentLink] = await Promise.all([
    prisma.userModuleAccess.findFirst({
      where: {
        userId: me.id,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: { in: ['controle-documentos', 'meus-documentos'] } },
      },
      select: { id: true },
    }),
    prisma.userDepartment.findFirst({
      where: {
        userId: me.id,
        departmentId: version.document.ownerDepartmentId,
      },
      select: { id: true },
    }),
  ])

  const canDownload =
    me.role === 'ADMIN' ||
    version.document.authorUserId === me.id ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink) ||
    Boolean(moduleAccess)

  if (!canDownload) {
    return NextResponse.json({ error: 'Sem acesso ao documento.' }, { status: 403 })
  }

  const termChallenge = await resolveTermChallenge(prisma, me.id)
  if (termChallenge) {
    return NextResponse.json(termChallenge, { status: 403 })
  }

  const term = await prisma.documentResponsibilityTerm.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } })
  if (term) {
    const acceptance = await prisma.documentTermAcceptance.findUnique({
      where: { termId_userId: { termId: term.id, userId: me.id } },
    })
    if (!acceptance) {
       return NextResponse.json(
        { requiresTerm: true, term: { id: term.id, title: term.title, content: term.content } },
        { status: 403 },
      )
    }
  }

  const resolvedFileUrl = version.fileUrl
    ? version.fileUrl
    : (
      await prisma.documentVersion.findFirst({
        where: { documentId: version.documentId, isCurrentPublished: true, fileUrl: { not: null } },
        orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }],
        select: { fileUrl: true },
      })
    )?.fileUrl ?? null

  if (!resolvedFileUrl) {
    return NextResponse.json({ error: 'Arquivo da versão publicada não encontrado.' }, { status: 404 })
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

  await registerDocumentAuditLog({
    action: 'DOWNLOAD',
    documentId: version.documentId,
    versionId,
    userId: me.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ url: resolvedFileUrl })
}