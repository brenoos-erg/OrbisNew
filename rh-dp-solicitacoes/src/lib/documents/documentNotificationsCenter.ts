import { Action, type DocumentNotificationEvent } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES,
  DOCUMENT_NOTIFICATION_EVENT_LABELS,
} from '@/lib/documents/documentNotificationTypes'
import { previewDocumentNotification, sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { requireAdminUser } from '@/lib/documentApprovalControl'

export async function requireNotificationAdmin(_action: Action = Action.VIEW) {
  return requireAdminUser()
}

export function getRuleDefaults(event: DocumentNotificationEvent) {
  return {
    event,
    enabled: true,
    notifyAuthor: true,
    notifyApproverGroup: event === 'DOCUMENT_SUBMITTED_FOR_APPROVAL' || event === 'DOCUMENT_APPROVED',
    notifyQualityReviewers:
      event === 'DOCUMENT_QUALITY_REVIEW' || event === 'DOCUMENT_EXPIRING' || event === 'DOCUMENT_EXPIRED',
    notifyOwnerDepartment: event === 'DOCUMENT_PUBLISHED' || event === 'DOCUMENT_REJECTED',
    notifyOwnerCostCenter: event === 'DOCUMENT_PUBLISHED' || event === 'DOCUMENT_REJECTED',
    notifyDistributionTargets: event === 'DOCUMENT_DISTRIBUTED',
    fixedEmailsJson: [],
    ccEmailsJson: [],
    subjectTemplate: DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES[event].subject,
    bodyTemplate: DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES[event].body,
  }
}

export async function getNotificationsCenterData(filters: { event?: string; status?: string; documentTypeId?: string }) {
  const [types, flows, rulesDb, logs] = await Promise.all([
    prisma.documentTypeCatalog.findMany({ select: { id: true, code: true, description: true }, orderBy: { description: 'asc' } }),
    prisma.documentTypeApprovalFlow.findMany({
      where: filters.documentTypeId ? { documentTypeId: filters.documentTypeId } : undefined,
      include: { approverGroup: { select: { id: true, name: true } }, documentType: { select: { id: true, description: true } } },
      orderBy: [{ documentTypeId: 'asc' }, { order: 'asc' }],
    }),
    prisma.documentNotificationRule.findMany({
      include: {
        documentType: { select: { id: true, description: true } },
        flowItem: { select: { id: true, order: true, approverGroup: { select: { name: true } } } },
      },
      orderBy: [{ event: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.documentNotificationLog.findMany({
      include: {
        document: { select: { code: true, title: true } },
        version: { select: { revisionNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
  ])

  const rules = (rulesDb as any[])
    .filter((rule: any) => (filters.event ? rule.event === filters.event : true))
    .filter((rule: any) => (filters.status === 'active' ? rule.enabled : filters.status === 'inactive' ? !rule.enabled : true))

  const today = new Date().toISOString().slice(0, 10)
  const logsToday = (logs as any[]).filter((item: any) => item.createdAt.toISOString().slice(0, 10) === today)
  const lastError = (logs as any[]).find((item: any) => item.status === 'FAILED')

  return {
    types,
    events: Object.entries(DOCUMENT_NOTIFICATION_EVENT_LABELS).map(([value, label]) => ({ value, label })),
    flowMap: (flows as any[]).map((flow: any) => ({
      id: flow.id,
      order: flow.order,
      stepType: flow.stepType,
      documentTypeId: flow.documentTypeId,
      documentTypeName: flow.documentType.description,
      approverGroupName: flow.approverGroup.name,
    })),
    rules,
    summary: {
      activeRules: rules.filter((item: any) => item.enabled).length,
      configuredEvents: new Set(rules.map((item: any) => item.event)).size,
      rulesWithAlerts: rules.filter(
        (item: any) =>
          !item.notifyAuthor &&
          !item.notifyApproverGroup &&
          !item.notifyQualityReviewers &&
          !item.notifyOwnerDepartment &&
          !item.notifyOwnerCostCenter &&
          !item.notifyDistributionTargets &&
          (!Array.isArray(item.fixedEmailsJson) || item.fixedEmailsJson.length === 0),
      ).length,
      sentToday: logsToday.filter((item: any) => item.status === 'SENT').length,
      failedToday: logsToday.filter((item: any) => item.status === 'FAILED').length,
      lastError: lastError
        ? {
            at: lastError.createdAt,
            event: lastError.event,
            error: lastError.error,
          }
        : null,
    },
    history: (logs as any[]).map((item: any) => ({
      id: item.id,
      createdAt: item.createdAt,
      event: item.event,
      eventLabel: DOCUMENT_NOTIFICATION_EVENT_LABELS[item.event as DocumentNotificationEvent],
      document: `${item.document.code} - ${item.document.title}`,
      revision: item.version ? `REV${String(item.version.revisionNumber).padStart(2, '0')}` : '-',
      recipientEmail: item.recipientEmail,
      recipientSource: item.recipientSource,
      status: item.status,
      error: item.error,
    })),
  }
}

export async function upsertNotificationRule(body: any) {
  const payload = {
    event: body?.event as DocumentNotificationEvent,
    documentTypeId: body?.documentTypeId || null,
    flowItemId: body?.flowItemId || null,
    enabled: Boolean(body?.enabled ?? true),
    notifyAuthor: Boolean(body?.notifyAuthor ?? true),
    notifyApproverGroup: Boolean(body?.notifyApproverGroup ?? false),
    notifyQualityReviewers: Boolean(body?.notifyQualityReviewers ?? false),
    notifyOwnerDepartment: Boolean(body?.notifyOwnerDepartment ?? false),
    notifyOwnerCostCenter: Boolean(body?.notifyOwnerCostCenter ?? false),
    notifyDistributionTargets: Boolean(body?.notifyDistributionTargets ?? false),
    fixedEmailsJson: Array.isArray(body?.fixedEmailsJson) ? body.fixedEmailsJson : [],
    ccEmailsJson: Array.isArray(body?.ccEmailsJson) ? body.ccEmailsJson : [],
    subjectTemplate: String(body?.subjectTemplate || '').trim(),
    bodyTemplate: String(body?.bodyTemplate || '').trim(),
  }

  if (!payload.event) throw new Error('Evento é obrigatório.')

  const defaults = getRuleDefaults(payload.event)
  const subjectTemplate = payload.subjectTemplate || defaults.subjectTemplate
  const bodyTemplate = payload.bodyTemplate || defaults.bodyTemplate

  if (body?.id) {
    return prisma.documentNotificationRule.update({ where: { id: body.id }, data: { ...payload, subjectTemplate, bodyTemplate } })
  }

  const existing = await prisma.documentNotificationRule.findFirst({
    where: { event: payload.event, documentTypeId: payload.documentTypeId, flowItemId: payload.flowItemId },
  })

  return existing
    ? prisma.documentNotificationRule.update({ where: { id: existing.id }, data: { ...payload, subjectTemplate, bodyTemplate } })
    : prisma.documentNotificationRule.create({ data: { ...defaults, ...payload, subjectTemplate, bodyTemplate } })
}

export async function previewNotification(body: any) {
  return previewDocumentNotification(body.event, {
    documentId: body.documentId,
    versionId: body.versionId || null,
    flowItemId: body.flowItemId || null,
    ruleId: body.ruleId || null,
  })
}

export async function testNotification(body: any) {
  return sendDocumentNotification(body.event, {
    documentId: body.documentId,
    versionId: body.versionId || null,
    flowItemId: body.flowItemId || null,
    ruleId: body.ruleId || null,
  })
}

export async function resendNotification(body: any) {
  const log = await prisma.documentNotificationLog.findUnique({ where: { id: body.logId } })
  if (!log) throw new Error('Registro não encontrado para reenvio.')

  return sendDocumentNotification(log.event, {
    documentId: log.documentId,
    versionId: log.versionId,
    ruleId: log.ruleId,
  })
}
