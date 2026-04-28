type RecipientUser = {
  id: string
  fullName: string | null
  email: string
}

export type WorkflowResolvedRecipientsLike = {
  departmentUsers: RecipientUser[]
  approverUsers: RecipientUser[]
  requester: string | null
  fixedEmails: string[]
  adminEmails: string[]
  finalRecipients: string[]
  approverIds: string[]
}

function normalizeAndValidateEmails(emails: string[]) {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return Array.from(new Set((emails ?? []).map((email) => email?.trim()).filter(Boolean))).filter(
    (email): email is string => Boolean(email && EMAIL_REGEX.test(email)),
  )
}

export function composeFinalWorkflowRecipients(input: {
  fixedEmails: string[]
  departmentUsers: RecipientUser[]
  approverUsers: RecipientUser[]
  adminEmails: string[]
  requester: string | null
}) {
  return normalizeAndValidateEmails([
    ...input.fixedEmails,
    ...input.departmentUsers.map((user) => user.email),
    ...input.approverUsers.map((user) => user.email),
    ...input.adminEmails,
    ...(input.requester ? [input.requester] : []),
  ])
}

export function buildWorkflowRecipientsDiagnostics(
  step: { kind: 'DEPARTAMENTO' | 'APROVACAO' | 'FIM'; notificationChannels?: { notifyDepartment?: boolean; notifyApprover?: boolean } },
  resolved: WorkflowResolvedRecipientsLike,
) {
  const warnings: string[] = []
  const errors: string[] = []

  if (step.kind === 'DEPARTAMENTO' && (step.notificationChannels?.notifyDepartment ?? true) && resolved.departmentUsers.length === 0) {
    warnings.push('Etapa sem destinatários automáticos do departamento.')
  }

  if (step.kind === 'APROVACAO') {
    if ((step.notificationChannels?.notifyApprover ?? true) && resolved.approverUsers.length === 0) {
      errors.push('Etapa de aprovação sem aprovador configurado.')
    }
    if (resolved.approverIds.length === 0) {
      warnings.push('Nenhum aprovador está vinculado ao tipo desta solicitação.')
    }
  }

  if (resolved.finalRecipients.length === 0) {
    errors.push('Nenhum destinatário final após aplicar os canais desta regra.')
  }

  return {
    hasDepartmentRecipients: resolved.departmentUsers.length > 0,
    hasApprovers: resolved.approverUsers.length > 0,
    hasFinalRecipients: resolved.finalRecipients.length > 0,
    warnings,
    errors,
  }
}
