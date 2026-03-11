import { NonConformityStatus, Prisma, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'

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

  if (resolved.recipients.length === 0) {
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

  const to = resolved.recipients.map((x) => x.email)
  const subject = `NC ${resolved.nc.numeroRnc}: ação necessária para centro envolvido`
  const text = [
    `A não conformidade ${resolved.nc.numeroRnc} envolve um centro de custo vinculado a você.`,
    '',
    `Status: ${resolved.nc.status}`,
    `Descrição: ${resolved.nc.descricao.slice(0, 400)}`,
    '',
    'Acesse o módulo SST para visualizar e tratar a NC.',
  ].join('\n')

  const mailResult = await sendMail({ to, subject, text }, 'ALERTS')

  await db.nonConformityTimeline.create({
    data: {
      nonConformityId: input.nonConformityId,
      actorId: input.actorId ?? null,
      tipo: 'ALERTA',
      message: `${marker} (${resolved.recipients.length} destinatário(s); envio=${mailResult.sent ? 'ok' : 'falha'})`,
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