import { DocumentApprovalStatus, DocumentVersionStatus, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasDocumentPermission } from '@/lib/documents/documentRoleAccess'
import { resolvePrivateDocumentPublishedPath, resolvePublicDocumentPath } from '@/lib/documents/documentStorage'

export type DocumentTermChallenge = {
  requiresTerm: true
  term: { id: string; title: string; content: string }
}

export type DocumentAccessIntent = 'view' | 'download' | 'print'

const POSTING_ERROR_HISTORICAL_ACCESS_MESSAGE = 'Documento excluído por erro de postagem. Disponível apenas para consulta histórica autorizada.'

function isPostingErrorInactiveDocument(document: { isActive?: boolean | null; inactiveReason?: string | null }) {
  return document.isActive === false && String(document.inactiveReason ?? '').includes('POSTING_ERROR')
}

function privatePublishedKeyFromUrl(value?: string | null) {
  const prefix = 'private-published:'
  const normalized = String(value ?? '').trim()
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length).trim() : null
}

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
          author: { select: { fullName: true } },
        },
      },
      approvals: {
        where: { status: DocumentApprovalStatus.APPROVED, decidedById: { not: null } },
        orderBy: { flowItem: { order: 'desc' } },
        include: { decidedBy: { select: { fullName: true } } },
        take: 1,
      },
    },
  })

  if (!version) return { error: 'Versão do documento não encontrada.', status: 404 as const }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true },
  })
  if (!me) return { error: 'Usuário inválido.', status: 401 as const }

  const ownerDepartmentId = version.document.ownerDepartmentId
  const permissionContext = {
    documentId: version.documentId,
    documentTypeId: version.document.documentTypeId,
    departmentId: ownerDepartmentId,
    costCenterId: version.document.ownerCostCenterId,
    documentFamily: version.document.code.split('.')[1] ?? null,
  }

  const [moduleAccess, departmentLink, canViewByDocumentRole] = await Promise.all([
    prisma.userModuleAccess.findFirst({
      where: {
        userId,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: { in: ['controle-documentos', 'meus-documentos'] } },
      },
      select: { id: true, level: true },
    }),
    ownerDepartmentId
      ? prisma.userDepartment.findFirst({
        where: { userId, departmentId: ownerDepartmentId },
        select: { id: true },
      })
      : Promise.resolve(null),
    hasDocumentPermission(userId, 'CAN_VIEW_PUBLISHED', permissionContext),
  ])

  const canRead =
    me.role === 'ADMIN' ||
    version.document.authorUserId === userId ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink) ||
    Boolean(moduleAccess) ||
    canViewByDocumentRole

  if (!canRead) return { error: 'Sem acesso ao documento.', status: 403 as const }

  const canHistorical = me.role === 'ADMIN' || moduleAccess?.level === ModuleLevel.NIVEL_3
  if (intent && isPostingErrorInactiveDocument(version.document) && !canHistorical) {
    return { error: POSTING_ERROR_HISTORICAL_ACCESS_MESSAGE, status: 403 as const }
  }

  const operationallyAvailable =
    version.status === DocumentVersionStatus.PUBLICADO &&
    version.isCurrentPublished &&
    !version.operationalUseBlocked

  if (intent && !operationallyAvailable) {
    const historicalStatus =
      version.status === DocumentVersionStatus.PUBLICADO ||
      version.status === DocumentVersionStatus.OBSOLETO

    if (!canHistorical || !historicalStatus) {
      return { error: 'Versões obsoletas são apenas para consulta histórica autorizada.', status: 403 as const }
    }
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

  let absolutePath: string | null = null
  let resolvedFileUrl: string | null = null

  const privateStorageKey = version.publishedStorageKey
    ?? privatePublishedKeyFromUrl(version.publishedFileUrl)
    ?? privatePublishedKeyFromUrl(version.fileUrl)

  if (privateStorageKey) {
    try {
      const resolved = await resolvePrivateDocumentPublishedPath(privateStorageKey)
      absolutePath = resolved.absolutePath
      resolvedFileUrl = version.publishedOriginalName || resolved.storageKey
    } catch {
      absolutePath = null
    }
  }

  const publicCandidates = [version.publishedFileUrl, version.fileUrl]
    .filter((value): value is string => Boolean(value?.trim()) && !privatePublishedKeyFromUrl(value))

  if (!absolutePath) {
    for (const candidateFileUrl of Array.from(new Set(publicCandidates))) {
      const pathResolution = await resolvePublicDocumentPath(candidateFileUrl)
      console.info('[documents.version-access] published-file-candidate-check', {
        versionId,
        candidateFileUrl,
        resolvedFileUrl: pathResolution.resolvedFileUrl,
        absolutePath: pathResolution.absolutePath,
        exists: pathResolution.exists,
        attemptedAbsolutePaths: pathResolution.attemptedAbsolutePaths,
      })

      if (!pathResolution.exists) continue
      absolutePath = pathResolution.absolutePath
      resolvedFileUrl = pathResolution.resolvedFileUrl
      break
    }
  }

  if (!absolutePath || !resolvedFileUrl) {
    return { error: 'Arquivo da versão publicada não encontrado no armazenamento físico.', status: 404 as const }
  }

  return {
    versionId: version.id,
    documentId: version.documentId,
    fileUrl: resolvedFileUrl,
    absolutePath,
    revisionNumber: version.revisionNumber,
    documentCode: version.document.code,
    documentTitle: version.document.title,
    publicationDate: version.publishedAt ?? null,
    elaboratorName: version.document.author.fullName,
    approverName: version.approvals[0]?.decidedBy?.fullName ?? '-',
    moduleLevel: moduleAccess?.level ?? null,
    expiresAt: version.expiresAt ?? null,
    isCurrentPublished: version.isCurrentPublished,
  }
}
