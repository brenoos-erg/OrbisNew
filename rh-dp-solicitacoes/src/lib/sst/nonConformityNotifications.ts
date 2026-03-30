import { ModuleLevel, NonConformityStatus, Prisma, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { ensureNonConformityAlertConfig, renderNcAlertTemplate } from '@/lib/sst/nonConformityAlertConfig'

type DbClient = Prisma.TransactionClient | typeof prisma

type NotifyInput = {
  nonConformityId: string
  actorId?: string | null
  trigger: 'created' | 'migrated' | 'retroactive'
  db?: DbClient
}

const RETROACTIVE_ELIGIBLE_STATUSES: NonConformityStatus[] = [
  NonConformityStatus.ABERTA,
  NonConformityStatus.EM_TRATATIVA,
  NonConformityStatus.AGUARDANDO_VERIFICACAO,
  NonConformityStatus.APROVADA_QUALIDADE,
]
const QUALITY_MODULE_KEYS = ['SST', 'sgi-qualidade', 'sgi_qualidade'] as const
export async function resolveNonConformityRecipientUsers(nonConformityId: string, db: DbClient = prisma) {
  const nc = await db.nonConformity.findUnique({
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

  const uniqueById = new Map<string, { id: string; fullName: string; email: string }>()
  for (const user of users) {
    if (!user.email?.trim()) continue
    if (user.id === nc.solicitanteId) continue
    uniqueById.set(user.id, user)
  }

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
  for (const access of qualityModuleUsers) {
    if (!access.user.email?.trim()) continue
    if (access.user.id === nc.solicitanteId) continue
    uniqueById.set(access.user.id, access.user)
  }

  return {
    nc,
    recipients: Array.from(uniqueById.values()),
  }
}

function markerMessage(trigger: NotifyInput['trigger']) {
  return `[ALERTA_ENVOLVIDOS_${trigger.toUpperCase()}] Notificação enviada para centros envolvidos`
}

export async function notifyNonConformityStakeholders(input: NotifyInput) {
  const db = input.db ?? prisma
  const resolved = await resolveNonConformityRecipientUsers(input.nonConformityId, db)
  if (!resolved) return { sent: false, reason: 'nc-not-found' as const }

  const marker = markerMessage(input.trigger)
  const existing = await db.nonConformityTimeline.findFirst({
    where: {
      nonConformityId: input.nonConformityId,
      tipo: 'ALERTA',
      message: marker,
    },
    select: { id: true },
  })
  if (existing) return { sent: false, reason: 'already-notified' as const }

  const config = await ensureNonConformityAlertConfig()
  const eventEnabled = input.trigger === 'created' ? config.eventCreatedEnabled : config.eventUpdatedEnabled
  if (!eventEnabled) {
    return { sent: false, reason: 'event-disabled' as const }
  }

  const configRecipients = (config.recipients ?? []).map((recipient: { email: string }) => recipient.email).filter(Boolean)
  const mergedRecipients = new Set([...resolved.recipients.map((x) => x.email), ...configRecipients])
  const to = Array.from(mergedRecipients)
  if (to.length === 0) {
    await db.nonConformityTimeline.create({
      data: {
        nonConformityId: input.nonConformityId,
        actorId: input.actorId ?? null,
        tipo: 'ALERTA',
        message: `${marker} (sem destinatários ativos)`,
      },
    })
    return { sent: false, reason: 'no-recipients' as const }
  }
  const templateValues = {
    numeroRnc: resolved.nc.numeroRnc,
    descricao: resolved.nc.descricao.slice(0, 1000),
    status: resolved.nc.status,
    responsavel: resolved.recipients[0]?.fullName || '-',
    data: new Date().toLocaleString('pt-BR'),
  }
  const subject = renderNcAlertTemplate(config.subjectTemplate, templateValues)
  const text = renderNcAlertTemplate(config.bodyTemplate, templateValues)

  const mailResult = await sendMail({ to, subject, text }, 'ALERTS')
  if (!mailResult.sent) {
    console.error('Falha no envio de alerta de NC', {
      nonConformityId: input.nonConformityId,
      trigger: input.trigger,
      recipients: to.length,
      error: mailResult.error,
    })
  }

  await db.nonConformityTimeline.create({
    data: {
      nonConformityId: input.nonConformityId,
      actorId: input.actorId ?? null,
      tipo: 'ALERTA',
      message: `${marker} (${to.length} destinatário(s); envio=${mailResult.sent ? 'ok' : 'falha'})`,
    },
  })

  return { sent: mailResult.sent, reason: mailResult.sent ? 'ok' as const : 'mail-failed' as const }
}

export async function notifyRetroactiveOpenNonConformities(limit = 500) {
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
      trigger: 'retroactive',
    })
    if (result.reason === 'ok') summary.notified += 1
    else summary.skipped += 1
  }

  return summary
}