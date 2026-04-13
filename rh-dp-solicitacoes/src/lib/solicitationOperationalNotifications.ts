import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { resolveAppBaseUrl } from '@/lib/site-url'
import { normalizeAndValidateEmails } from '@/lib/solicitationEmailTemplates'
import { appendSolicitationEmailLog } from '@/lib/solicitationEmailLogStore'

export type SolicitationNotificationEvent =
  | 'OPENED'
  | 'STEP_CHANGED'
  | 'AWAITING_APPROVAL'
  | 'UPDATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FINALIZED'
  | 'CANCELED'

export type NotifySolicitationEventInput = {
  solicitationId: string
  event: SolicitationNotificationEvent
  actorName?: string | null
  reason?: string | null
  dedupeKey?: string | null
}

type ResolvedSolicitation = Awaited<ReturnType<typeof loadSolicitationForNotification>>

async function loadSolicitationForNotification(solicitationId: string) {
  return prisma.solicitation.findUnique({
    where: { id: solicitationId },
    include: {
      tipo: { select: { codigo: true, nome: true } },
      solicitante: { select: { id: true, email: true, fullName: true } },
      assumidaPor: { select: { id: true, email: true, fullName: true } },
      approver: { select: { id: true, email: true, fullName: true } },
      department: { select: { id: true, name: true } },
    },
  })
}

async function getDepartmentMemberEmails(departmentId?: string | null) {
  if (!departmentId) return [] as string[]
  const users = await prisma.user.findMany({
    where: {
      status: 'ATIVO',
      OR: [{ departmentId }, { userDepartments: { some: { departmentId } } }],
    },
    select: { email: true },
  })
  return users.map((u) => u.email)
}

function buildSubject(event: SolicitationNotificationEvent, protocolo: string, tipoCodigo?: string | null) {
  const prefix = tipoCodigo ? `[${tipoCodigo}]` : '[Solicitação]'
  const labels: Record<SolicitationNotificationEvent, string> = {
    OPENED: 'Nova solicitação aberta',
    STEP_CHANGED: 'Solicitação em nova etapa',
    AWAITING_APPROVAL: 'Solicitação aguardando aprovação',
    UPDATED: 'Atualização relevante na solicitação',
    APPROVED: 'Solicitação aprovada',
    REJECTED: 'Solicitação reprovada',
    FINALIZED: 'Solicitação concluída',
    CANCELED: 'Solicitação cancelada',
  }
  return `${prefix} ${labels[event]} · ${protocolo}`
}

function buildBody(input: {
  event: SolicitationNotificationEvent
  solicitation: NonNullable<ResolvedSolicitation>
  link: string
  actorName?: string | null
  reason?: string | null
}) {
  const { event, solicitation, link, actorName, reason } = input
  const eventText: Record<SolicitationNotificationEvent, string> = {
    OPENED: 'Uma nova solicitação foi registrada e precisa de acompanhamento operacional.',
    STEP_CHANGED: 'A solicitação mudou de etapa e pode exigir ação do setor atual.',
    AWAITING_APPROVAL: 'A solicitação entrou em etapa de aprovação.',
    UPDATED: 'A solicitação recebeu atualização relevante.',
    APPROVED: 'A solicitação foi aprovada.',
    REJECTED: 'A solicitação foi reprovada.',
    FINALIZED: 'A solicitação foi concluída.',
    CANCELED: 'A solicitação foi cancelada.',
  }

  return [
    'Olá,',
    '',
    eventText[event],
    '',
    `Protocolo: ${solicitation.protocolo}`,
    `Tipo: ${solicitation.tipo?.codigo ?? '-'} - ${solicitation.tipo?.nome ?? '-'}`,
    `Status atual: ${solicitation.status}`,
    `Departamento atual: ${solicitation.department?.name ?? '-'}`,
    actorName ? `Responsável pela ação: ${actorName}` : null,
    reason ? `Detalhe: ${reason}` : null,
    '',
    `Acesse: ${link}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function resolveRecipients(
  solicitation: NonNullable<ResolvedSolicitation>,
  event: SolicitationNotificationEvent,
) {
  const deptEmails = await getDepartmentMemberEmails(solicitation.departmentId)
  const watchers = Array.isArray((solicitation.payload as any)?.notificationWatchers)
    ? ((solicitation.payload as any).notificationWatchers as string[])
    : []

  switch (event) {
    case 'OPENED':
    case 'STEP_CHANGED':
      return [...deptEmails, solicitation.assumidaPor?.email, solicitation.approver?.email]
    case 'AWAITING_APPROVAL':
      return [solicitation.approver?.email, ...deptEmails]
    case 'UPDATED':
      return [solicitation.assumidaPor?.email, solicitation.approver?.email, ...deptEmails, ...watchers]
    case 'APPROVED':
    case 'REJECTED':
      return [solicitation.solicitante?.email, solicitation.assumidaPor?.email, ...deptEmails]
    case 'FINALIZED':
    case 'CANCELED':
      return [solicitation.solicitante?.email, ...deptEmails, solicitation.assumidaPor?.email]
    default:
      return []
  }
}

export async function notifySolicitationEvent(input: NotifySolicitationEventInput) {
  const solicitation = await loadSolicitationForNotification(input.solicitationId)
  if (!solicitation) return { skipped: true as const, reason: 'solicitation_not_found' as const }

  const payload = (solicitation.payload ?? {}) as Record<string, any>
  const policy = (payload.notificationPolicy ?? {}) as Record<string, any>
  const dedupeState = (policy.dedupe ?? {}) as Record<string, { key?: string; at?: string }>
  const eventState = dedupeState[input.event]
  const dedupeKey = input.dedupeKey?.trim() || null

  if (dedupeKey && eventState?.key === dedupeKey && eventState?.at) {
    const elapsedMs = Date.now() - new Date(eventState.at).getTime()
    if (elapsedMs >= 0 && elapsedMs < 90_000) {
      return { skipped: true as const, reason: 'deduplicated' as const }
    }
  }

  const rawRecipients = (await resolveRecipients(solicitation, input.event)).filter(
    (email): email is string => Boolean(email),
  )
  const recipients = normalizeAndValidateEmails(rawRecipients)
  if (recipients.length === 0) {
    await appendSolicitationEmailLog({
      solicitationId: solicitation.id,
      typeId: solicitation.tipoId,
      event: input.event.toLowerCase(),
      recipients: [],
      status: 'SKIPPED',
      templateKey: 'operational-default',
      error: 'Nenhum destinatário para o evento operacional.',
    })
    return { skipped: true as const, reason: 'no_recipients' as const }
  }

  const baseUrl = resolveAppBaseUrl({ context: 'solicitation-email' })
  const link = baseUrl ? `${baseUrl}/dashboard/solicitacoes?open=${solicitation.id}` : ''
  const subject = buildSubject(input.event, solicitation.protocolo, solicitation.tipo?.codigo)
  const text = buildBody({
    event: input.event,
    solicitation,
    link,
    actorName: input.actorName,
    reason: input.reason,
  })

  const result = await sendMail({ to: recipients, subject, text }, 'NOTIFICATIONS')

  await appendSolicitationEmailLog({
    solicitationId: solicitation.id,
    typeId: solicitation.tipoId,
    event: input.event.toLowerCase(),
    recipients,
    status: result.sent ? 'SUCCESS' : 'FAILED',
    templateKey: 'operational-default',
    subject,
    error: result.sent ? null : result.error ?? 'Falha no envio operacional.',
    metadata: { dedupeKey: dedupeKey ?? null },
  })

  const nowIso = new Date().toISOString()
  const audit = Array.isArray(policy.audit) ? policy.audit : []
  const nextAudit = [
    ...audit,
    {
      event: input.event,
      to: recipients,
      subject,
      template: 'operational-default',
      at: nowIso,
      result,
    },
  ].slice(-50)

  await prisma.solicitation.update({
    where: { id: solicitation.id },
    data: {
      payload: {
        ...payload,
        notificationPolicy: {
          ...policy,
          dedupe: {
            ...dedupeState,
            [input.event]: {
              key: dedupeKey,
              at: nowIso,
            },
          },
          audit: nextAudit,
          lastEvent: input.event,
          lastEventAt: nowIso,
        },
      },
    },
  })

  return { skipped: false as const, result, recipientsCount: recipients.length }
}