import type { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { WorkflowStepDraft } from '@/lib/solicitationWorkflowsStore'
import { normalizeModuleKey } from '@/lib/moduleKey'
import { isModuleLevelAtLeast } from '@/lib/moduleLevel'
import { normalizeAndValidateEmails } from '@/lib/solicitationEmailTemplates'
import { buildWorkflowRecipientsDiagnostics, composeFinalWorkflowRecipients } from '@/lib/workflowNotificationDiagnostics'
import { resolveTipoApproverIds } from '@/lib/solicitationTipoApprovers'

type ModuleAccessLike = {
  level: ModuleLevel
  module: { key: string }
}

type RecipientUser = {
  id: string
  fullName: string | null
  email: string
}

type ResolveRecipientsInput = {
  step: WorkflowStepDraft
  tipoId: string
  fallbackDepartmentId?: string | null
  solicitation?: {
    approverId?: string | null
    requesterEmail?: string | null
  }
}

export type WorkflowResolvedRecipients = {
  departmentUsers: RecipientUser[]
  approverUsers: RecipientUser[]
  requester: string | null
  fixedEmails: string[]
  adminEmails: string[]
  finalRecipients: string[]
  approverIds: string[]
  accessRule: {
    moduleKey: string
    minLevel: ModuleLevel
  }
}

export type WorkflowRecipientsDiagnostics = {
  hasDepartmentRecipients: boolean
  hasApprovers: boolean
  hasFinalRecipients: boolean
  warnings: string[]
  errors: string[]
}

export function hasRequiredWorkflowNotificationAccess(
  userAccess: ModuleAccessLike[],
  moduleKey: string,
  minLevel: ModuleLevel,
) {
  const normalizedTargetKey = normalizeModuleKey(moduleKey)

  return userAccess.some((access) => {
    const normalizedAccessKey = normalizeModuleKey(access.module.key)
    return normalizedAccessKey === normalizedTargetKey && isModuleLevelAtLeast(access.level, minLevel)
  })
}

export function resolveNotificationAccessRule(step: WorkflowStepDraft): { moduleKey: string; minLevel: ModuleLevel } {
  const maybeModuleKey = (step as WorkflowStepDraft & { notificationModuleKey?: string }).notificationModuleKey
  const maybeMinLevel = (step as WorkflowStepDraft & { notificationMinLevel?: ModuleLevel }).notificationMinLevel

  return {
    moduleKey: normalizeModuleKey(maybeModuleKey?.trim() || 'solicitacoes'),
    minLevel: maybeMinLevel ?? 'NIVEL_3',
  }
}


export async function resolveWorkflowNotificationRecipients(input: ResolveRecipientsInput): Promise<WorkflowResolvedRecipients> {
  const channels = input.step.notificationChannels ?? {}
  const accessRule = resolveNotificationAccessRule(input.step)
  const departmentId = input.step.defaultDepartmentId ?? input.fallbackDepartmentId ?? null

  const departmentUsersRaw =
    channels.notifyDepartment === false || input.step.kind !== 'DEPARTAMENTO' || !departmentId
      ? []
      : await prisma.user.findMany({
          where: {
            status: 'ATIVO',
            OR: [{ departmentId }, { userDepartments: { some: { departmentId } } }],
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            moduleAccesses: {
              select: { level: true, module: { select: { key: true } } },
            },
          },
        })

  const departmentUsers = departmentUsersRaw
    .filter(
      (user) =>
        Boolean(user.email) &&
        hasRequiredWorkflowNotificationAccess(user.moduleAccesses, accessRule.moduleKey, accessRule.minLevel),
    )
    .map((user) => ({ id: user.id, fullName: user.fullName, email: user.email }))

  const tipoApproverIds = input.step.kind === 'APROVACAO' ? await resolveTipoApproverIds(input.tipoId) : []
  const approverIds =
    input.step.kind === 'APROVACAO'
      ? Array.from(new Set([...(input.step.approverUserIds ?? []), ...(input.solicitation?.approverId ? [input.solicitation.approverId] : []), ...tipoApproverIds]))
      : []

  const approverUsers =
    channels.notifyApprover === false || approverIds.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: { id: { in: approverIds }, status: 'ATIVO' },
            select: { id: true, fullName: true, email: true },
          })
        )
          .filter((user) => Boolean(user.email))
          .map((user) => ({ id: user.id, fullName: user.fullName, email: user.email }))

  const fixedEmails = normalizeAndValidateEmails(input.step.notificationEmails ?? [])
  const adminEmails = channels.notifyAdmins ? normalizeAndValidateEmails(input.step.notificationAdminEmails ?? []) : []
  const requester = channels.notifyRequester ? input.solicitation?.requesterEmail?.trim() || null : null

  const finalRecipients = composeFinalWorkflowRecipients({
    fixedEmails,
    departmentUsers,
    approverUsers,
    adminEmails,
    requester,
  })

  return {
    departmentUsers,
    approverUsers,
    requester,
    fixedEmails,
    adminEmails,
    finalRecipients,
    approverIds,
    accessRule,
  }
}

export async function previewWorkflowNotificationRecipients(input: Omit<ResolveRecipientsInput, 'solicitation'>) {
  return resolveWorkflowNotificationRecipients(input)
}


export { composeFinalWorkflowRecipients, buildWorkflowRecipientsDiagnostics }
