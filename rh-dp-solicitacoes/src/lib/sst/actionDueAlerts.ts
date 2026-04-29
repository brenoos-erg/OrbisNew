import { NonConformityActionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dueEventFromDays, isActionAlertEligible, notifyActionItemUpdate } from '@/lib/sst/actionPlanNotifications'

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function diffDays(a: Date, b: Date) { return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000) }

export async function runActionDueAlerts(options?: { now?: Date }) {
  const now = options?.now ?? new Date()
  const items = await prisma.nonConformityActionItem.findMany({ where: { prazo: { not: null }, status: { not: NonConformityActionStatus.CONCLUIDA } }, select: { id: true, origemPlano: true, prazo: true, status: true } })
  const summary = { total: items.length, sent: 0, skipped: 0, failed: 0 }

  for (const item of items) {
    try {
      if (!item.prazo || !isActionAlertEligible(item.status)) { summary.skipped += 1; continue }
      const daysToDue = diffDays(item.prazo, now)
      const event = dueEventFromDays(item.origemPlano, daysToDue)
      if (!event) { summary.skipped += 1; continue }
      const marker = `[${event}]`
      const existing = await prisma.nonConformityTimeline.findFirst({ where: { message: { contains: `${marker}[ACTION:${item.id}]` }, createdAt: { gte: startOfDay(now) } }, select: { id: true } })
      if (existing) { summary.skipped += 1; continue }
      const result = await notifyActionItemUpdate(item.id, event)
      if (result.sent) summary.sent += 1
      else summary.failed += 1
    } catch (error) {
      summary.failed += 1
      console.error('Falha ao processar alerta de vencimento', { actionItemId: item.id, error })
    }
  }
  return summary
}
