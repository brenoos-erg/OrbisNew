import { DocumentApprovalStatus, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
  const [moduleAccess, departmentLink] = await Promise.all([
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
  ])

  const canRead =
    me.role === 'ADMIN' ||
    version.document.authorUserId === userId ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink