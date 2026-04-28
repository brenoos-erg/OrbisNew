import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { resolveAppBaseUrl } from '@/lib/site-url'
import { readWorkflowRows, type WorkflowStepDraft, type WorkflowStepKind } from '@/lib/solicitationWorkflowsStore'
import { renderTemplate, resolveTemplate } from '@/lib/solicitationEmailTemplates'
import { buildWorkflowNotificationPath } from '@/lib/workflowNotificationLink'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { appendSolicitationEmailLog } from '@/lib/solicitationEmailLogStore'
import { resolveWorkflowNotificationRecipients } from '@/lib/workflowNotificationRecipients'

type NotifyInput = {
  solicitationId: string
  preferredKind?: WorkflowStepKind
  preferredDepartmentId?: string | null
  forceReplay?: boolean
}

function pickTargetStep(
  steps: WorkflowStepDraft[],
  preferredKind?: WorkflowStepKind,
  preferredDepartmentId?: string | null,
  lastNotifiedStepKey?: string,
) {
  if (preferredKind === 'APROVACAO') return steps.find((s) => s.kind === 'APROVACAO')

  const departments = steps.filter((s) => s.kind === 'DEPARTAMENTO')
  if (preferredDepartmentId) {
    const byDepartment = departments.find((s) => s.defaultDepartmentId === preferredDepartmentId)
    if (byDepartment) return byDepartment
  }

  if (lastNotifiedStepKey) {
    const idx = departments.findIndex((step) => step.stepKey === lastNotifiedStepKey)
    if (idx >= 0 && idx + 1 < departments.length) return departments[idx + 1]
  }

  return departments[0]
}

export async function notifyWorkflowStepEntry(input: NotifyInput) {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: input.solicitationId },
    include: {
      tipo: { select: { id: true, nome: true, codigo: true } },
      solicitante: { select: { fullName: true, email: true } },
      approver: { select: { email: true } },
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

  const templateKey = targetStep.kind === 'APROVACAO' ? 'approvalTemplate' : 'notificationTemplate'
  const event = targetStep.kind === 'APROVACAO' ? 'notificacao_aprovador' : `etapa_${targetStep.order}`

  if (targetStep.enabled === false) {
    await appendSolicitationEmailLog({
      solicitationId: solicitation.id,
      typeId: solicitation.tipoId,
      event,
      recipients: [],
      status: 'SKIPPED',
      templateKey,
      error: 'Regra de disparo desativada no painel.',
    })
    return { skipped: true, reason: 'rule_disabled' as const }
  }

  if (!input.forceReplay && lastNotifiedStepKey === targetStep.stepKey) {
    return { skipped: true, reason: 'already_notified' as const }
  }

  const resolved = await resolveWorkflowNotificationRecipients({
    step: targetStep,
    tipoId: solicitation.tipoId,
    fallbackDepartmentId: solicitation.departmentId,
    solicitation: {
      approverId: solicitation.approverId,
      requesterEmail: solicitation.solicitante?.email,
    },
  })

  if (!solicitation.approverId && resolved.approverIds[0]) {
    await prisma.solicitation.update({
      where: { id: solicitation.id },
      data: { approverId: resolved.approverIds[0] },
    })
  }

  if (targetStep.kind === 'APROVACAO' && resolved.approverIds.length === 0) {
    await appendSolicitationEmailLog({
      solicitationId: solicitation.id,
      typeId: solicitation.tipoId,
      event,
      recipients: [],
      status: 'SKIPPED',
      templateKey,
      error: 'Etapa de aprovação sem aprovador configurado.',
    })
    return { skipped: true, reason: 'no_approver_configured' as const }
  }

  const recipients = resolved.finalRecipients
  if (recipients.length === 0) {
    await appendSolicitationEmailLog({
      solicitationId: solicitation.id,
      typeId: solicitation.tipoId,
      event,
      recipients: [],
      status: 'SKIPPED',
      templateKey,
      error: 'Nenhum destinatário após aplicar regras de canal.',
    })
    return { skipped: true, reason: 'no_recipients' as const }
  }

  const template = resolveTemplate(targetStep.kind === 'APROVACAO' ? targetStep.approvalTemplate : targetStep.notificationTemplate)
  const baseUrl = resolveAppBaseUrl({ context: 'workflow-email' })
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    return { skipped: true, reason: 'invalid_base_url' as const }
  }

  const solicitationPath = buildWorkflowNotificationPath(targetStep.kind, solicitation.id)
  const values = {
    protocolo: solicitation.protocolo,
    tipoCodigo: solicitation.tipo?.codigo ?? solicitation.tipo?.id ?? '-',
    tipoNome: solicitation.tipo?.nome ?? '-',
    solicitante: solicitation.solicitante?.fullName ?? solicitation.solicitante?.email ?? '-',
    departamentoAtual: solicitation.department?.name ?? targetStep.label,
    link: baseUrl ? `${baseUrl}${solicitationPath}` : '',
  }

  const subject = renderTemplate(template.subject, values)
  const text = renderTemplate(template.body, values)

  const startedAt = performance.now()
  const result = await sendMail({ to: recipients, subject, text }, 'NOTIFICATIONS')
  const elapsedMs = Math.round(performance.now() - startedAt)

  if (!result.sent) {
    await appendSolicitationEmailLog({
      solicitationId: solicitation.id,
      typeId: solicitation.tipoId,
      event,
      recipients,
      status: 'FAILED',
      templateKey,
      subject,
      error: result.error ?? 'Falha ao enviar e-mail.',
      metadata: { provider: result.provider ?? null, elapsedMs },
    })
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

  await appendSolicitationEmailLog({
    solicitationId: solicitation.id,
    typeId: solicitation.tipoId,
    event,
    recipients,
    status: 'SUCCESS',
    templateKey,
    subject,
    metadata: { provider: result.provider ?? null, elapsedMs },
  })

  await notifySolicitationEvent({
    solicitationId: solicitation.id,
    event: targetStep.kind === 'APROVACAO' ? 'AWAITING_APPROVAL' : 'STEP_CHANGED',
    dedupeKey: input.forceReplay
      ? `WORKFLOW:REPLAY:${targetStep.stepKey}:${solicitation.id}:${Date.now()}`
      : `WORKFLOW:${targetStep.stepKey}:${solicitation.id}`,
  })

  return { skipped: false, targetStep: targetStep.stepKey, result }
}
