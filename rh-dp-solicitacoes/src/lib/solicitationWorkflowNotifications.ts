import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { DEFAULT_TEMPLATE, readWorkflowRows, type WorkflowStepDraft, type WorkflowStepKind } from '@/lib/solicitationWorkflowsStore'

type NotifyInput = {
  solicitationId: string
  preferredKind?: WorkflowStepKind
  preferredDepartmentId?: string | null
}

const PLACEHOLDER_REGEX = /\{(protocolo|tipoCodigo|tipoNome|solicitante|departamentoAtual|link)\}/g

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(PLACEHOLDER_REGEX, (_, key: string) => values[key] ?? '')
}

function pickTargetStep(steps: WorkflowStepDraft[], preferredKind?: WorkflowStepKind, preferredDepartmentId?: string | null) {
  if (preferredKind === 'APROVACAO') {
    return steps.find((s) => s.kind === 'APROVACAO')
  }

  const departments = steps.filter((s) => s.kind === 'DEPARTAMENTO')
  if (preferredDepartmentId) {
    const byDepartment = departments.find((s) => s.defaultDepartmentId === preferredDepartmentId)
    if (byDepartment) return byDepartment
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

  const targetStep = pickTargetStep(workflow.steps, input.preferredKind, input.preferredDepartmentId ?? solicitation.departmentId)
  if (!targetStep) return { skipped: true, reason: 'step_not_found' as const }

  const payload = (solicitation.payload ?? {}) as Record<string, any>
  const lastNotifiedStepKey = payload?.workflowEmail?.lastNotifiedStepKey as string | undefined
  if (lastNotifiedStepKey === targetStep.stepKey) {
    return { skipped: true, reason: 'already_notified' as const }
  }

  let recipients: string[] = []
  let subjectTemplate = DEFAULT_TEMPLATE.subject
  let bodyTemplate = DEFAULT_TEMPLATE.body

  if (targetStep.kind === 'APROVACAO') {
    const users = await prisma.user.findMany({
      where: { id: { in: targetStep.approverUserIds ?? [] } },
      select: { email: true },
    })
    recipients = users.map((user) => user.email).filter(Boolean)
    subjectTemplate = targetStep.approvalTemplate?.subject || DEFAULT_TEMPLATE.subject
    bodyTemplate = targetStep.approvalTemplate?.body || DEFAULT_TEMPLATE.body
  } else {
    recipients = targetStep.notificationEmails ?? []
    subjectTemplate = targetStep.notificationTemplate?.subject || DEFAULT_TEMPLATE.subject
    bodyTemplate = targetStep.notificationTemplate?.body || DEFAULT_TEMPLATE.body
  }

  recipients = Array.from(new Set(recipients.map((x) => x.trim()).filter(Boolean)))
  if (recipients.length === 0) {
    await prisma.solicitation.update({
      where: { id: solicitation.id },
      data: {
        payload: {
          ...payload,
          workflowEmail: {
            ...(payload.workflowEmail ?? {}),
            lastNotifiedStepKey: targetStep.stepKey,
            lastNotifiedAt: new Date().toISOString(),
            skipped: true,
          },
        },
      },
    })
    return { skipped: true, reason: 'no_recipients' as const }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const values = {
    protocolo: solicitation.protocolo,
    tipoCodigo: solicitation.tipo?.codigo ?? solicitation.tipo?.id ?? '-',
    tipoNome: solicitation.tipo?.nome ?? '-',
    solicitante: solicitation.solicitante?.fullName ?? solicitation.solicitante?.email ?? '-',
    departamentoAtual: solicitation.department?.name ?? targetStep.label,
    link: `${baseUrl}/dashboard/solicitacoes/${solicitation.id}`,
  }

  const subject = fillTemplate(subjectTemplate, values)
  const text = fillTemplate(bodyTemplate, values)

  const result = await sendMail({ to: recipients, subject, text }, 'NOTIFICATIONS')

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