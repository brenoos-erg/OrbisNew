import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type DocumentTermChallenge = {
  requiresTerm: true
  term: { id: string; title: string; content: string }
}

export async function resolveDocumentVersionAccess(versionId: string, userId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: true,
    },
  })

  if (!version) {
    return { error: 'Versão do documento não encontrada.', status: 404 as const }
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true },
  })

  if (!me) {
    return { error: 'Usuário inválido.', status: 401 as const }
  }

  const [moduleAccess, departmentLink] = await Promise.all([
    prisma.userModuleAccess.findFirst({
      where: {
        userId,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: { in: ['controle-documentos', 'meus-documentos'] } },
      },
      select: { id: true },
    }),
    prisma.userDepartment.findFirst({
      where: {
        userId,
        departmentId: version.document.ownerDepartmentId,
      },
      select: { id: true },
    }),
  ])

  const canRead =
    me.role === 'ADMIN' ||
    version.document.authorUserId === userId ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink) ||
    Boolean(moduleAccess)

  if (!canRead) {
    return { error: 'Sem acesso ao documento.', status: 403 as const }
  }

  const term = await prisma.documentResponsibilityTerm.findFirst({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (term) {
    const acceptance = await prisma.documentTermAcceptance.findUnique({
      where: { termId_userId: { termId: term.id, userId } },
      select: { id: true },
    })
    if (!acceptance) {
      return {
        termChallenge: {
          requiresTerm: true,
          term: { id: term.id, title: term.title, content: term.content },
        } satisfies DocumentTermChallenge,
        status: 403 as const,
      }
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
    return { error: 'Arquivo da versão publicada não encontrado.', status: 404 as const }
  }

  return {
    versionId: version.id,
    documentId: version.documentId,
    fileUrl: resolvedFileUrl,
    revisionNumber: version.revisionNumber,
    documentCode: version.document.code,
    documentTitle: version.document.title,
  }
}