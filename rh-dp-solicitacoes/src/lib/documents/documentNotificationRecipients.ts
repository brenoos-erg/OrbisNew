import { prisma } from '@/lib/prisma'
import { isValidNotificationEmail, normalizeAndValidateEmails } from '@/lib/documents/documentNotificationRecipients.utils'

export type RecipientOrigin =
  | 'author'
  | 'approverGroup'
  | 'qualityReviewers'
  | 'ownerDepartment'
  | 'ownerCostCenter'
  | 'distributionTargets'
  | 'fixedEmails'

export type ResolvedNotificationRecipient = {
  email: string
  userId: string | null
  fullName: string | null
  origin: RecipientOrigin
}


type Params = {
  documentId: string
  versionId?: string | null
  flowItemId?: string | null
  notifyAuthor?: boolean
  notifyApproverGroup?: boolean
  notifyQualityReviewers?: boolean
  notifyOwnerDepartment?: boolean
  notifyOwnerCostCenter?: boolean
  notifyDistributionTargets?: boolean
  fixedEmails?: string[]
}

export async function resolveDocumentNotificationRecipients(input: Params) {
  const warnings: string[] = []
  const byOrigin: Record<RecipientOrigin, ResolvedNotificationRecipient[]> = {
    author: [],
    approverGroup: [],
    qualityReviewers: [],
    ownerDepartment: [],
    ownerCostCenter: [],
    distributionTargets: [],
    fixedEmails: [],
  }

  const doc = await prisma.isoDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      authorUserId: true,
      ownerDepartmentId: true,
      ownerCostCenterId: true,
      documentTypeId: true,
      author: { select: { id: true, fullName: true, email: true, status: true } },
    },
  })

  if (!doc) {
    return { recipients: [], byOrigin, warnings: ['Documento não encontrado.'] }
  }

  const pushUser = (origin: RecipientOrigin, user: { id: string; fullName: string | null; email: string | null; status?: string | null }) => {
    if (user.status && user.status !== 'ATIVO') return
    const email = String(user.email ?? '').trim().toLowerCase()
    if (!isValidNotificationEmail(email)) return
    byOrigin[origin].push({ email, userId: user.id, fullName: user.fullName, origin })
  }

  if (input.notifyAuthor) {
    pushUser('author', doc.author)
    if (byOrigin.author.length === 0) warnings.push('Elaborador sem e-mail válido/ativo.')
  }

  if (input.notifyApproverGroup) {
    let groupId: string | null = null
    if (input.flowItemId) {
      const flowItem = await prisma.documentTypeApprovalFlow.findUnique({
        where: { id: input.flowItemId },
        select: { approverGroupId: true },
      })
      groupId = flowItem?.approverGroupId ?? null
    }
    if (!groupId) {
      const firstFlow = await prisma.documentTypeApprovalFlow.findFirst({
        where: { documentTypeId: doc.documentTypeId, active: true },
        orderBy: { order: 'asc' },
        select: { approverGroupId: true },
      })
      groupId = firstFlow?.approverGroupId ?? null
    }
    if (groupId) {
      const members = await prisma.approverGroupMember.findMany({
        where: { groupId },
        select: { user: { select: { id: true, fullName: true, email: true, status: true } } },
      })
      members.forEach((item) => pushUser('approverGroup', item.user))
    }
    if (byOrigin.approverGroup.length === 0) warnings.push('Grupo aprovador sem destinatários ativos.')
  }

  if (input.notifyQualityReviewers) {
    const qualityUsers = await prisma.documentApprovalControl.findMany({
      where: { active: true, canApproveTab3: true },
      select: { user: { select: { id: true, fullName: true, email: true, status: true } } },
    })
    qualityUsers.forEach((item) => pushUser('qualityReviewers', item.user))
    if (byOrigin.qualityReviewers.length === 0) warnings.push('Revisão da qualidade sem destinatários ativos.')
  }

  if (input.notifyOwnerDepartment && doc.ownerDepartmentId) {
    const deptUsers = await prisma.user.findMany({
      where: { status: 'ATIVO', OR: [{ departmentId: doc.ownerDepartmentId }, { userDepartments: { some: { departmentId: doc.ownerDepartmentId } } }] },
      select: { id: true, fullName: true, email: true, status: true },
      take: 300,
    })
    deptUsers.forEach((user) => pushUser('ownerDepartment', user))
    if (byOrigin.ownerDepartment.length === 0) warnings.push('Departamento responsável sem destinatários ativos.')
  }

  if (input.notifyOwnerCostCenter && doc.ownerCostCenterId) {
    const ccUsers = await prisma.user.findMany({
      where: { status: 'ATIVO', OR: [{ costCenterId: doc.ownerCostCenterId }, { costCenters: { some: { costCenterId: doc.ownerCostCenterId } } }] },
      select: { id: true, fullName: true, email: true, status: true },
      take: 300,
    })
    ccUsers.forEach((user) => pushUser('ownerCostCenter', user))
    if (byOrigin.ownerCostCenter.length === 0) warnings.push('Centro de custo responsável sem destinatários ativos.')
  }

  if (input.notifyDistributionTargets && input.versionId) {
    const targets = await prisma.distributionTarget.findMany({
      where: { distribution: { versionId: input.versionId } },
      select: { user: { select: { id: true, fullName: true, email: true, status: true } } },
    })
    targets.forEach((item) => pushUser('distributionTargets', item.user))
    if (byOrigin.distributionTargets.length === 0) warnings.push('Distribuição sem destinatários ativos.')
  }

  normalizeAndValidateEmails(input.fixedEmails).forEach((email) => {
    byOrigin.fixedEmails.push({ email, userId: null, fullName: null, origin: 'fixedEmails' })
  })

  const deduped = new Map<string, ResolvedNotificationRecipient>()
  ;(Object.keys(byOrigin) as RecipientOrigin[]).forEach((origin) => {
    byOrigin[origin].forEach((item) => {
      if (!deduped.has(item.email)) deduped.set(item.email, item)
    })
  })

  if (deduped.size === 0) warnings.push('Nenhum destinatário final foi resolvido para a regra.')

  return {
    recipients: Array.from(deduped.values()),
    byOrigin,
    warnings,
  }
}
