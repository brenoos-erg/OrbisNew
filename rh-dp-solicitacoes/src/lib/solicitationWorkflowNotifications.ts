import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { resolveAppBaseUrl } from '@/lib/site-url'
import type { ModuleLevel } from '@prisma/client'
import { readWorkflowRows, type WorkflowStepDraft, type WorkflowStepKind } from '@/lib/solicitationWorkflowsStore'
import { normalizeAndValidateEmails, renderTemplate, resolveTemplate } from '@/lib/solicitationEmailTemplates'
import { normalizeModuleKey } from '@/lib/moduleKey'
import { hasRequiredWorkflowNotificationAccess } from '@/lib/workflowNotificationRecipients'

type NotifyInput = {
  solicitationId: string
  preferredKind?: WorkflowStepKind
  preferredDepartmentId?: string | null
}

type NotificationAccessRule = {
  moduleKey: string
  minLevel: ModuleLevel
}

function resolveNotificationAccessRule(step: WorkflowStepDraft): NotificationAccessRule {
  const maybeModuleKey = (step as WorkflowStepDraft & { notificationModuleKey?: string }).notificationModuleKey
  const maybeMinLevel = (step as WorkflowStepDraft & { notificationMinLevel?: ModuleLevel }).notificationMinLevel

  const moduleKey = normalizeModuleKey(maybeModuleKey?.trim() || 'solicitacoes')
  const minLevel = maybeMinLevel ?? 'NIVEL_3'

  return { moduleKey, minLevel }
}

async function resolveDepartmentRecipients(step: WorkflowStepDraft, fallbackDepartmentId?: string | null) {
  const manual = step.notificationEmails ?? []
  const departmentId = step.defaultDepartmentId ?? fallbackDepartmentId
  const accessRule = resolveNotificationAccessRule(step)

  const auto = departmentId
    ? await prisma.user.findMany({
        where: {
          status: 'ATIVO',
          OR: [
            { departmentId },
            { userDepartments: { some: { departmentId } } },
          ],
        },
        select: {
          email: true,
          moduleAccesses: {
            select: {
              level: true,
              module: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
       })
    : []

  const automaticRecipients = auto
    .filter((user) =>
      hasRequiredWorkflowNotificationAccess(user.moduleAccesses, accessRule.moduleKey, accessRule.minLevel),
    )
    .map((user) => user.email)

  return Array.from(
    new Set([
      ...manual,
      ...automaticRecipients,
    ].map((x) => x?.trim()).filter(Boolean) as string[]),
  )
}

function pickTargetStep(
  steps: WorkflowStepDraft[],
  preferredKind?: WorkflowStepKind,
  preferredDepartmentId?: string | null,
  lastNotifiedStepKey?: string,
) {
  if (preferredKind === 'APROVACAO') {
    return steps.find((s) => s.kind === 'APROVACAO')
  }

  const departments = steps.filter((s) => s.kind === 'DEPARTAMENTO')
  if (preferredDepartmentId) {
    const byDepartment = departments.find((s) => s.defaultDepartmentId === preferredDepartmentId)
    if (byDepartment) return byDepartment
  }

  if (lastNotifiedStepKey) {
    const idx = departments.findIndex((step) => step.stepKey === lastNotifiedStepKey)
    if (idx >= 0 && idx + 1 < departments.length) {
      return departments[idx + 1]
    }
  }

  return departments[0]
}

export async function notifyWorkflowStepEntry(input: NotifyInput) {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: input.solicitationId },
    include: {
      tipo: { select: { id: true, nome: true, codigo: true } },
      solicitante: { select: { fullName: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  })

  if (!solicitation) return { skipped: true, reason: 'solicitation_not_found' as const }

  const workflows = await readWorkflowRows()
  const workflow = workflows.find((row) => row.tipoId === solicitation.tipoId)
  if (!workflow) return { skipped: true, reason: 'workflow_not_found' as const }

  const payload = (solicitation.payload ?? {}) as Record<string, any>
  const lastNotifiedStepKey = payload?.workflowEmail?.lastNotifiedStepKey as string | undefined
  const targetStep = pickTargetStep(
    workflow.steps,
    input.preferredKind,
    input.preferredDepartmentId ?? solicitation.departmentId,
    lastNotifiedStepKey,
  )
  if (!targetStep) return { skipped: true, reason: 'step_not_found' as const }

  if (lastNotifiedStepKey === targetStep.stepKey) {
    return { skipped: true, reason: 'already_notified' as const }
  }

  let recipients: string[] = []
  let subjectTemplate = ''
  let bodyTemplate = ''

  if (targetStep.kind === 'APROVACAO') {
    const approverIds = Array.from(
      new Set([
        ...(targetStep.approverUserIds ?? []),
        solicitation.approverId ?? '',
      ].filter(Boolean)),
    )

    const users = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { email: true },
    })
    recipients = users.map((user) => user.email).filter(Boolean)
    const template = resolveTemplate(targetStep.approvalTemplate)
    subjectTemplate = template.subject
    bodyTemplate = template.body
  } else {
    recipients = await resolveDepartmentRecipients(targetStep, solicitation.departmentId)
    const template = resolveTemplate(targetStep.notificationTemplate)
    subjectTemplate = template.subject
    bodyTemplate = template.body
  }

  recipients = normalizeAndValidateEmails(recipients)
  if (recipients.length === 0) {
     return { skipped: true, reason: 'no_recipients' as const }
  }

  const baseUrl = resolveAppBaseUrl({ context: 'workflow-email' })
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    return { skipped: true, reason: 'invalid_base_url' as const }
  }

  const values = {
    protocolo: solicitation.protocolo,
    tipoCodigo: solicitation.tipo?.codigo ?? solicitation.tipo?.id ?? '-',
    tipoNome: solicitation.tipo?.nome ?? '-',
    solicitante: solicitation.solicitante?.fullName ?? solicitation.solicitante?.email ?? '-',
    departamentoAtual: solicitation.department?.name ?? targetStep.label,
    link: baseUrl ? `${baseUrl}/dashboard/solicitacoes/${solicitation.id}` : '',
  }

  const subject = renderTemplate(subjectTemplate, values)
  const text = renderTemplate(bodyTemplate, values)

  const startedAt = performance.now()
  const result = await sendMail({ to: recipients, subject, text }, 'NOTIFICATIONS')
  const elapsedMs = Math.round(performance.now() - startedAt)
  console.info('[workflow-email]', {
     provider: result.provider,
    sent: result.sent,
    error: result.error,
  })

  if (!result.sent) {
    return { skipped: true, reason: 'send_failed' as const, result }
  }

  await prisma.solicitation.update({
    where: { id: solicitation.id },
    data: {
      payload: {
        ...payload,
        workflowEmail: {
          ...(payload.workflowEmail ?? {}),
          lastNotifiedStepKey: targetStep.stepKey,
          lastNotifiedAt: new Date().toISOString(),
          lastResult: result,
        },
      },
    },
  })

  return { skipped: false, targetStep: targetStep.stepKey, result }
}