import { ModuleLevel, NonConformityActionPlanOrigin, NonConformityActionStatus, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

type DbClient = typeof prisma

type StandaloneEvent =
  | 'STANDALONE_ACTION_CREATED'
  | 'STANDALONE_ACTION_ASSIGNED'
  | 'STANDALONE_ACTION_UPDATED'
  | 'STANDALONE_ACTION_COMPLETED'
  | 'STANDALONE_ACTION_DUE_IN_30_DAYS'
  | 'STANDALONE_ACTION_DUE_IN_20_DAYS'
  | 'STANDALONE_ACTION_DUE_IN_10_DAYS'
  | 'STANDALONE_ACTION_DUE_IN_5_DAYS'
  | 'STANDALONE_ACTION_OVERDUE_DAILY'
  | 'NC_ACTION_DUE_IN_30_DAYS'
  | 'NC_ACTION_DUE_IN_20_DAYS'
  | 'NC_ACTION_DUE_IN_10_DAYS'
  | 'NC_ACTION_DUE_IN_5_DAYS'
  | 'NC_ACTION_OVERDUE_DAILY'

const QUALITY_MODULE_KEYS = ['SST', 'sgi-qualidade', 'sgi_qualidade'] as const

export async function notifyActionItemUpdate(actionItemId: string, event: StandaloneEvent, db: DbClient = prisma) {
  const action = await db.nonConformityActionItem.findUnique({
    where: { id: actionItemId },
    include: { nonConformity: { select: { id: true } }, createdBy: true, responsavel: true },
  })
  if (!action) return { sent: false, reason: 'action-not-found' as const }

  const qualityUsers = await db.userModuleAccess.findMany({
    where: { level: { in: [ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] }, module: { key: { in: [...QUALITY_MODULE_KEYS] } }, user: { status: UserStatus.ATIVO } },
    select: { user: { select: { email: true } } },
  })

  const recipients = new Set<string>()
  const push = (email?: string | null) => { if (email?.includes('@')) recipients.add(email.trim()) }
  if (action.responsavel?.status === UserStatus.ATIVO) push(action.responsavel?.email)
  if (action.createdBy?.status === UserStatus.ATIVO) push(action.createdBy?.email)
  for (const q of qualityUsers) push(q.user.email)

  if (!action.responsavelId && action.responsavelNome) {
    if (action.nonConformityId) {
      await appendNonConformityTimelineEvent(db, { nonConformityId: action.nonConformityId, actorId: null, tipo: 'ALERTA', message: 'Alerta não enviado: ação sem usuário responsável vinculado.' })
    }
    console.warn('Ação criada com responsável em texto livre; sem notificação automática por ausência de usuário vinculado.')
  }

  const to = Array.from(recipients)
  if (!to.length) return { sent: false, reason: 'no-recipients' as const }

  const subject = `[SST] Atualização de ação (${event})`
  const text = `Ação: ${action.descricao}\nStatus: ${action.status}\nPrazo: ${action.prazo ? action.prazo.toISOString().slice(0,10) : '-'}\nEvento: ${event}`
  const result = await sendMail({ to, subject, text }, 'ALERTS')

  if (action.nonConformityId) {
    const marker = `[${event}] `
    const msg = event.includes('OVERDUE') ? 'Alerta diário enviado: ação vencida e ainda não concluída.' : event.includes('30_DAYS') ? 'Alerta de vencimento enviado ao responsável: faltam 30 dias.' : event.includes('20_DAYS') ? 'Alerta de vencimento enviado ao responsável: faltam 20 dias.' : event.includes('10_DAYS') ? 'Alerta de vencimento enviado ao responsável: faltam 10 dias.' : event.includes('5_DAYS') ? 'Alerta de vencimento enviado ao responsável: faltam 5 dias.' : `Notificação de ação enviada (${event}).`
    await appendNonConformityTimelineEvent(db, { nonConformityId: action.nonConformityId, actorId: null, tipo: 'ALERTA', message: result.sent ? `${marker}[ACTION:${action.id}] ${msg}` : `Falha no envio de alerta de vencimento da ação: ${result.error || 'erro desconhecido'}.` })
  }

  return { sent: result.sent, reason: result.sent ? 'ok' as const : 'mail-failed' as const }
}

export function dueEventFromDays(origin: NonConformityActionPlanOrigin, days: number) {
  if (days < 0) return origin === NonConformityActionPlanOrigin.PLANO_AVULSO ? 'STANDALONE_ACTION_OVERDUE_DAILY' : 'NC_ACTION_OVERDUE_DAILY'
  if (days === 30) return origin === NonConformityActionPlanOrigin.PLANO_AVULSO ? 'STANDALONE_ACTION_DUE_IN_30_DAYS' : 'NC_ACTION_DUE_IN_30_DAYS'
  if (days === 20) return origin === NonConformityActionPlanOrigin.PLANO_AVULSO ? 'STANDALONE_ACTION_DUE_IN_20_DAYS' : 'NC_ACTION_DUE_IN_20_DAYS'
  if (days === 10) return origin === NonConformityActionPlanOrigin.PLANO_AVULSO ? 'STANDALONE_ACTION_DUE_IN_10_DAYS' : 'NC_ACTION_DUE_IN_10_DAYS'
  if (days === 5) return origin === NonConformityActionPlanOrigin.PLANO_AVULSO ? 'STANDALONE_ACTION_DUE_IN_5_DAYS' : 'NC_ACTION_DUE_IN_5_DAYS'
  return null
}

export function isActionAlertEligible(status: NonConformityActionStatus) {
  return status !== NonConformityActionStatus.CONCLUIDA
}
