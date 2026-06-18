import { ModuleLevel, NonConformityStatus, Prisma, Role, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { ensureNonConformityAlertConfig, renderNcAlertTemplate } from '@/lib/sst/nonConformityAlertConfig'
import { isNonConformityAlertEventEnabled, type NonConformityNotificationEvent } from '@/lib/sst/nonConformityAlertRules'

type DbClient = Prisma.TransactionClient | typeof prisma

type NotifyInput = {
  nonConformityId: string
  actorId?: string | null
  event: NonConformityNotificationEvent
  actionItemId?: string | null
  db?: DbClient
}

type RecipientReason = 'centro envolvido' | 'solicitante' | 'responsável da ação' | 'qualidade' | 'destinatário fixo'

const RECIPIENT_REASON_DESCRIPTIONS: Record<RecipientReason, string> = {
  'centro envolvido': 'Você recebeu este alerta porque está vinculado ao centro de custo envolvido na NC.',
  solicitante: 'Você recebeu este alerta porque é o solicitante da NC.',
  'responsável da ação': 'Você recebeu este alerta porque é responsável por uma ação do plano.',
  qualidade: 'Você recebeu este alerta porque possui perfil da Qualidade.',
  'destinatário fixo': 'Você recebeu este alerta porque é um destinatário fixo configurado para este tipo de alerta.',
}

type RecipientUser = { id: string; fullName: string; email: string }

type RecipientWithReasons = RecipientUser & { reasons: RecipientReason[] }

type RecipientResolution = {
  nc: {
    id: string
    numeroRnc: string
    descricao: string
    solicitanteId: string
    status: NonConformityStatus
    centroQueDetectouId: string
    centroQueOriginouId: string
  }
  recipients: RecipientWithReasons[]
  marker: string
  includeConfiguredRecipients?: boolean
}

const CONFIGURED_RECIPIENT_ALLOWED_EVENTS: NonConformityNotificationEvent[] = []

const RETROACTIVE_ELIGIBLE_STATUSES: NonConformityStatus[] = [
  NonConformityStatus.ABERTA,
  NonConformityStatus.EM_TRATATIVA,
  NonConformityStatus.AGUARDANDO_VERIFICACAO,
  NonConformityStatus.APROVADA_QUALIDADE,
]
const QUALITY_MODULE_KEYS = ['SST', 'sgi-qualidade', 'sgi_qualidade'] as const


function getDefaultSubjectTemplateForEvent(event: NonConformityNotificationEvent) {
  switch (event) {
    case 'NC_CREATED':
      return 'NC {{numeroRnc}} registrada'
    case 'ACTION_ITEM_ASSIGNED':
      return 'NC {{numeroRnc}}: ação atribuída'
    case 'ACTION_ITEM_COMPLETED':
    case 'EFFECTIVENESS_REVIEW_REQUESTED':
      return 'NC {{numeroRnc}}: verificação necessária'
    default:
      return 'NC {{numeroRnc}}: atualização registrada'
  }
}

function resolveSubjectTemplate(event: NonConformityNotificationEvent, configuredTemplate: string) {
  const trimmedTemplate = configuredTemplate.trim()
  if (trimmedTemplate === 'NC {{numeroRnc}}: ação necessária' || trimmedTemplate === 'NC {{numeroRnc}}: atualização registrada') {
    return getDefaultSubjectTemplateForEvent(event)
  }
  return configuredTemplate
}

async function findNc(nonConformityId: string, db: DbClient) {
  return db.nonConformity.findUnique({
    where: { id: nonConformityId },
    select: {
      id: true,
      numeroRnc: true,
      descricao: true,
      solicitanteId: true,
      centroQueDetectouId: true,
      centroQueOriginouId: true,
      status: true,
    },
  })
}

function dedupeRecipients(users: Array<{ id: string; fullName: string; email: string | null | undefined }>, excludes: Set<string> = new Set()) {
  const uniqueById = new Map<string, RecipientUser>()
  for (const user of users) {
    const email = user.email?.trim()
    if (!email) continue
    if (excludes.has(user.id)) continue
    uniqueById.set(user.id, { id: user.id, fullName: user.fullName, email })
  }
  return Array.from(uniqueById.values())
}

export async function resolveNonConformityQualityRecipients(nonConformityId: string, db: DbClient = prisma) {
  const nc = await findNc(nonConformityId, db)
  if (!nc) return null

  const qualityModuleUsers = await db.userModuleAccess.findMany({
    where: {
      level: { in: [ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
      module: {
        key: { in: [...QUALITY_MODULE_KEYS] },
      },
      user: {
        status: UserStatus.ATIVO,
      },
    },
    select: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  })

  return {
    nc,
    recipients: dedupeRecipients(qualityModuleUsers.map((access) => access.user), new Set([nc.solicitanteId])),
  }
}

export async function resolveNonConformityInvolvedAreaRecipients(nonConformityId: string, db: DbClient = prisma) {
  const nc = await findNc(nonConformityId, db)
  if (!nc) return null

  const users = await db.user.findMany({
    where: {
      status: UserStatus.ATIVO,
      OR: [
        { costCenterId: { in: [nc.centroQueDetectouId, nc.centroQueOriginouId] } },
        {
          costCenters: {
            some: {
              costCenterId: { in: [nc.centroQueDetectouId, nc.centroQueOriginouId] },
            },
          },
        },
      ],
    },
    select: { id: true, fullName: true, email: true },
  })

  return {
    nc,
    recipients: dedupeRecipients(users, new Set([nc.solicitanteId])),
  }
}

export async function resolveNonConformityRequesterRecipients(nonConformityId: string, db: DbClient = prisma) {
  const nc = await findNc(nonConformityId, db)
  if (!nc) return null

  const requester = await db.user.findUnique({
    where: { id: nc.solicitanteId },
    select: { id: true, fullName: true, email: true, status: true },
  })

  const recipients = requester && requester.status === UserStatus.ATIVO
    ? dedupeRecipients([requester])
    : []

  return { nc, recipients }
}

export async function resolveActionPlanResponsibleRecipients(actionItemId: string, db: DbClient = prisma) {
  const actionItem = await db.nonConformityActionItem.findUnique({
    where: { id: actionItemId },
    select: { responsavelId: true },
  })
  if (!actionItem?.responsavelId) return []

  const responsible = await db.user.findUnique({
    where: { id: actionItem.responsavelId },
    select: { id: true, fullName: true, email: true, status: true },
  })
  if (!responsible || responsible.status !== UserStatus.ATIVO) return []

  return dedupeRecipients([responsible])
}

export async function resolveNonConformityNotificationRecipientsByEvent(
  input: Pick<NotifyInput, 'nonConformityId' | 'event' | 'actionItemId'>,
  db: DbClient = prisma,
): Promise<RecipientResolution | null> {
  const quality = await resolveNonConformityQualityRecipients(input.nonConformityId, db)
  if (!quality) return null
  const involved = await resolveNonConformityInvolvedAreaRecipients(input.nonConformityId, db)
  const requester = await resolveNonConformityRequesterRecipients(input.nonConformityId, db)

  const recipientsById = new Map<string, RecipientWithReasons>()
  const addRecipients = (reason: RecipientReason, list: RecipientUser[] = []) => {
    for (const user of list) {
      const existing = recipientsById.get(user.id)
      if (existing) {
        if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
        continue
      }
      recipientsById.set(user.id, { ...user, reasons: [reason] })
    }
  }

  let marker = '[ALERTA_NC] Notificação processada'
  let includeConfiguredRecipients = false

  switch (input.event) {
    case 'NC_CREATED':
      marker = '[ALERTA_NC_CREATED] Notificação de abertura enviada para solicitante e centros envolvidos'
      addRecipients('centro envolvido', involved?.recipients)
      addRecipients('solicitante', requester?.recipients)
      break
    case 'NC_APPROVED_BY_QUALITY':
      marker = '[ALERTA_NC_APPROVED_BY_QUALITY] Notificação pós-aprovação enviada para centros envolvidos'
      addRecipients('centro envolvido', involved?.recipients)
      addRecipients('solicitante', requester?.recipients)
      break
    case 'NC_REJECTED_BY_QUALITY':
      marker = '[ALERTA_NC_REJECTED_BY_QUALITY] Notificação de reprovação enviada para solicitante e centros envolvidos'
      addRecipients('solicitante', requester?.recipients)
      addRecipients('centro envolvido', involved?.recipients)
      break
    case 'NC_UPDATED':
      marker = '[ALERTA_NC_UPDATED] Notificação de atualização enviada para envolvidos'
      addRecipients('solicitante', requester?.recipients)
      addRecipients('centro envolvido', involved?.recipients)
      if (input.actionItemId) addRecipients('responsável da ação', await resolveActionPlanResponsibleRecipients(input.actionItemId, db))
      break
    case 'NC_REOPENED':
      marker = '[ALERTA_NC_REOPENED] Notificação de reabertura enviada para Qualidade e envolvidos'
      addRecipients('qualidade', quality.recipients)
      addRecipients('centro envolvido', involved?.recipients)
      break
    case 'NC_CANCELLED':
    case 'NC_CLOSED':
      marker = `[ALERTA_${input.event}] Notificação de encerramento/cancelamento enviada para partes envolvidas`
      addRecipients('qualidade', quality.recipients)
      addRecipients('centro envolvido', involved?.recipients)
      addRecipients('solicitante', requester?.recipients)
      break
    case 'ACTION_PLAN_CREATED':
      marker = '[ALERTA_ACTION_PLAN_CREATED] Notificação de plano de ação enviada aos responsáveis'
      if (input.actionItemId) addRecipients('responsável da ação', await resolveActionPlanResponsibleRecipients(input.actionItemId, db))
      addRecipients('qualidade', quality.recipients)
      break
    case 'ACTION_ITEM_ASSIGNED':
      marker = '[ALERTA_ACTION_ITEM_ASSIGNED] Notificação de ação enviada ao responsável'
      if (input.actionItemId) addRecipients('responsável da ação', await resolveActionPlanResponsibleRecipients(input.actionItemId, db))
      break
    case 'ACTION_ITEM_UPDATED':
      marker = '[ALERTA_ACTION_ITEM_UPDATED] Notificação de atualização de ação enviada conforme regra'
      if (input.actionItemId) addRecipients('responsável da ação', await resolveActionPlanResponsibleRecipients(input.actionItemId, db))
      break
    case 'ACTION_ITEM_COMPLETED':
      marker = '[ALERTA_ACTION_ITEM_COMPLETED] Notificação de verificação enviada para Qualidade'
      addRecipients('qualidade', quality.recipients)
      break
    case 'ACTION_PLAN_COMPLETED':
      marker = '[ALERTA_ACTION_PLAN_COMPLETED] Notificação de plano concluído enviada para Qualidade, solicitante e área envolvida'
      addRecipients('qualidade', quality.recipients)
      addRecipients('solicitante', requester?.recipients)
      addRecipients('centro envolvido', involved?.recipients)
      break
    case 'EFFECTIVENESS_REVIEW_REQUESTED':
    case 'EFFECTIVENESS_APPROVED':
    case 'EFFECTIVENESS_REJECTED':
      marker = `[ALERTA_${input.event}] Notificação de verificação de eficácia enviada para Qualidade e solicitante`
      addRecipients('qualidade', quality.recipients)
      addRecipients('solicitante', requester?.recipients)
      break
    default:
      addRecipients('qualidade', quality.recipients)
      break
  }

  return {
    nc: quality.nc,
    marker,
    includeConfiguredRecipients,
    recipients: Array.from(recipientsById.values()),
  }
}


async function resolveActionPlanResponsibleName(actionItemId: string | null | undefined, db: DbClient) {
  if (!actionItemId) return null

  const actionItem = await db.nonConformityActionItem.findUnique({
    where: { id: actionItemId },
    select: { responsavel: { select: { fullName: true } } },
  })

  return actionItem?.responsavel?.fullName?.trim() || null
}

function formatRecipientReasonAudit(recipients: RecipientWithReasons[]) {
  return recipients
    .map((recipient) => `${recipient.email}: ${recipient.reasons.join(', ')}`)
    .join('; ')
}

function formatRecipientReasonExplanation(recipient: RecipientWithReasons) {
  return recipient.reasons
    .map((reason) => RECIPIENT_REASON_DESCRIPTIONS[reason])
    .join('\n') || '-'
}

export async function notifyNonConformityStakeholders(input: NotifyInput) {
  const db = input.db ?? prisma
  const resolved = await resolveNonConformityNotificationRecipientsByEvent(input, db)
  if (!resolved) return { sent: false, reason: 'nc-not-found' as const }

  const existing = await db.nonConformityTimeline.findFirst({
    where: {
      nonConformityId: input.nonConformityId,
      tipo: 'ALERTA',
      message: { startsWith: resolved.marker },
    },
    select: { id: true },
  })
  if (existing) return { sent: false, reason: 'already-notified' as const }

  const config = await ensureNonConformityAlertConfig()
  const eventEnabled = isNonConformityAlertEventEnabled(input.event, config)
  if (!eventEnabled) {
    return { sent: false, reason: 'event-disabled' as const }
  }

  const recipients = new Set(resolved.recipients.map((x) => x.email))
  const configuredRecipientsAdded: string[] = []
  if (resolved.includeConfiguredRecipients) {
    if (CONFIGURED_RECIPIENT_ALLOWED_EVENTS.includes(input.event)) {
      const configuredEmails = (config.recipients ?? [])
        .map((recipient: { email: string }) => recipient.email?.trim().toLowerCase())
        .filter(Boolean) as string[]
      if (configuredEmails.length > 0) {
        const users = await db.user.findMany({
          where: {
            email: { in: configuredEmails },
            status: UserStatus.ATIVO,
            OR: [
              { role: { in: [Role.ADMIN] } },
              {
                moduleAccesses: {
                  some: {
                    module: { key: { in: [...QUALITY_MODULE_KEYS] } },
                    level: { in: [ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
                  },
                },
              },
            ],
          },
          select: { id: true, fullName: true, email: true },
        })
        for (const user of users) {
          const email = user.email?.trim()
          if (!email) continue
          recipients.add(email)
          configuredRecipientsAdded.push(email)
          const existing = resolved.recipients.find((recipient) => recipient.id === user.id)
          if (existing) {
            if (!existing.reasons.includes('destinatário fixo')) existing.reasons.push('destinatário fixo')
          } else {
            resolved.recipients.push({ id: user.id, fullName: user.fullName, email, reasons: ['destinatário fixo'] })
          }
        }
      }
    }
  }

  const to = Array.from(recipients)
  if (to.length === 0) {
    await db.nonConformityTimeline.create({
      data: {
        nonConformityId: input.nonConformityId,
        actorId: input.actorId ?? null,
        tipo: 'ALERTA',
        message: `${resolved.marker} (sem destinatários ativos)`,
      },
    })
    return { sent: false, reason: 'no-recipients' as const }
  }

  const responsibleName = await resolveActionPlanResponsibleName(input.actionItemId, db) ?? '-'
  const subjectTemplate = resolveSubjectTemplate(input.event, config.subjectTemplate)
  const deliveryResults: Array<{ recipient: RecipientWithReasons; sent: boolean; error?: unknown }> = []

  for (const recipient of resolved.recipients.filter((item) => to.includes(item.email))) {
    const templateValues = {
      numeroRnc: resolved.nc.numeroRnc,
      descricao: resolved.nc.descricao.slice(0, 1000),
      status: resolved.nc.status,
      responsavel: responsibleName,
      motivoEnvio: formatRecipientReasonExplanation(recipient),
      motivosEnvio: formatRecipientReasonExplanation(recipient),
      data: new Date().toLocaleString('pt-BR'),
    }
    const subject = renderNcAlertTemplate(subjectTemplate, templateValues)
    const text = renderNcAlertTemplate(config.bodyTemplate, templateValues)
    const mailResult = await sendMail({ to: [recipient.email], subject, text }, 'ALERTS')

    deliveryResults.push({ recipient, sent: mailResult.sent, error: mailResult.error })
    if (!mailResult.sent) {
      console.error('Falha no envio de alerta de NC', {
        nonConformityId: input.nonConformityId,
        event: input.event,
        recipient: recipient.email,
        error: mailResult.error,
      })
    }
  }

  const recipientReasons = formatRecipientReasonAudit(deliveryResults.map((result) => result.recipient))
  const deliveryAudit = deliveryResults
    .map((result) => `${result.recipient.email}: ${result.sent ? 'ok' : 'falha'}`)
    .join('; ')
  const sentCount = deliveryResults.filter((result) => result.sent).length
  const failedCount = deliveryResults.length - sentCount

  await db.nonConformityTimeline.create({
    data: {
      nonConformityId: input.nonConformityId,
      actorId: input.actorId ?? null,
      tipo: 'ALERTA',
      message: `${resolved.marker} (evento=${input.event}; ${to.length} destinatário(s); motivos=${recipientReasons || '-'}; envio=${deliveryAudit || '-'}; ok=${sentCount}; falha=${failedCount}${configuredRecipientsAdded.length ? `; fixos=${configuredRecipientsAdded.join(', ')}` : ''})`,
    },
  })

  return { sent: sentCount > 0, reason: failedCount === 0 ? 'ok' as const : 'mail-failed' as const }
}

type RetroactiveNotifyOptions = {
  limit?: number
  confirm?: boolean
}

export async function notifyRetroactiveOpenNonConformities(options: RetroactiveNotifyOptions = {}) {
  const limit = options.limit ?? 500
  if (!options.confirm) {
    return { total: 0, notified: 0, skipped: 0, reason: 'confirmation-required' as const }
  }
  const items = await prisma.nonConformity.findMany({
    where: { status: { in: RETROACTIVE_ELIGIBLE_STATUSES } },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  const summary = { total: items.length, notified: 0, skipped: 0 }
  for (const item of items) {
    const result = await notifyNonConformityStakeholders({
      nonConformityId: item.id,
      event: 'NC_UPDATED',
    })
    if (result.reason === 'ok') summary.notified += 1
    else summary.skipped += 1
  }

  return summary
}
