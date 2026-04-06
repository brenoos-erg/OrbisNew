import { DocumentApprovalStatus, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolvePublicDocumentPath } from '@/lib/documents/documentStorage'

export type DocumentTermChallenge = {
  requiresTerm: true
  term: { id: string; title: string; content: string }
}

export type DocumentAccessIntent = 'view' | 'download' | 'print'

export async function resolveDocumentVersionAccess(
  versionId: string,
  userId: string,
  intent?: DocumentAccessIntent,
) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: {
        include: {
          author: {
            select: { fullName: true },
          },
        },
      },
      approvals: {
        where: { status: DocumentApprovalStatus.APPROVED, decidedById: { not: null } },
        orderBy: { flowItem: { order: 'desc' } },
        include: {
          decidedBy: {
            select: { fullName: true },
          },
        },
        take: 1,
      },
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

  const ownerDepartmentId = version.document.ownerDepartmentId

  const [moduleAccess, departmentLink] = await Promise.all([
    prisma.userModuleAccess.findFirst({
      where: {
        userId,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: { in: ['controle-documentos', 'meus-documentos'] } },
      },
      select: { id: true },
    }),
    ownerDepartmentId
      ? prisma.userDepartment.findFirst({
        where: {
          userId,
          departmentId: ownerDepartmentId,
        },
        select: { id: true },
      })
      : Promise.resolve(null),
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
    const acceptance = intent
      ? await prisma.documentTermActionAcceptance.findFirst({
        where: {
          termId: term.id,
          userId,
          versionId,
          intent: intent.toUpperCase(),
        },
        select: { id: true },
      })
      : await prisma.documentTermAcceptance.findUnique({
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
  const versionCandidates = [version.fileUrl]

  const publishedCandidates = await prisma.documentVersion.findMany({
    where: { documentId: version.documentId, isCurrentPublished: true, fileUrl: { not: null } },
    orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }],
    select: { id: true, fileUrl: true },
    take: 5,
  })

  for (const published of publishedCandidates) {
    versionCandidates.push(published.fileUrl)
  }

  const uniqueCandidates = Array.from(new Set(versionCandidates.filter((item): item is string => Boolean(item?.trim()))))

  let resolvedFileUrl: string | null = null

  for (const candidateFileUrl of uniqueCandidates) {
    const pathResolution = await resolvePublicDocumentPath(candidateFileUrl)
    console.info('[documents.version-access] file-url-candidate-check', {
      versionId,
      candidateFileUrl,
      resolvedFileUrl: pathResolution.resolvedFileUrl,
      absolutePath: pathResolution.absolutePath,
      exists: pathResolution.exists,
      attemptedAbsolutePaths: pathResolution.attemptedAbsolutePaths,
    })

    if (!pathResolution.exists) continue

    resolvedFileUrl = pathResolution.resolvedFileUrl
    break
  }

  if (!resolvedFileUrl) {
    return { error: 'Arquivo da versão publicada não encontrado no armazenamento físico.', status: 404 as const }
  }

   return {
    versionId: version.id,
    documentId: version.documentId,
    fileUrl: resolvedFileUrl,
    revisionNumber: version.revisionNumber,
    documentCode: version.document.code,
    documentTitle: version.document.title,
    publicationDate: version.publishedAt ?? null,
    elaboratorName: version.document.author.fullName,
    approverName: version.approvals[0]?.decidedBy?.fullName ?? '-',
  }
}