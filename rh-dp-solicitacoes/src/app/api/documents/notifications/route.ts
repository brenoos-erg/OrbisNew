import { NextRequest, NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES,
  DOCUMENT_NOTIFICATION_EVENT_LABELS,
  type DocumentNotificationEvent,
} from '@/lib/documents/documentNotificationTypes'
import { previewDocumentNotification, sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { requireAdminUser } from '@/lib/documentApprovalControl'

async function checkAccess(_action: Action) {
  try {
    const me = await requireAdminUser()
    return { me, canEdit: true }
  } catch {
    return null
  }
}

function getRuleDefaults(event: DocumentNotificationEvent) {
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

export async function GET(req: NextRequest) {
  const access = await checkAccess(Action.VIEW)
  if (!access) return NextResponse.json({ error: 'Sem permissão para visualizar a central de notificações.' }, { status: 403 })

  const params = req.nextUrl.searchParams
  const event = params.get('event')?.trim() || ''
  const status = params.get('status')?.trim() || ''
  const documentTypeId = params.get('documentTypeId')?.trim() || ''

  const [types, flows, rulesDb, logs] = await Promise.all([
    prisma.documentTypeCatalog.findMany({ select: { id: true, code: true, description: true }, orderBy: { description: 'asc' } }),
    prisma.documentTypeApprovalFlow.findMany({
      where: documentTypeId ? { documentTypeId } : undefined,
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
      take: 200,
    }),
  ])

  const rules = (rulesDb as any[])
    .filter((rule: any) => (event ? rule.event === event : true))
    .filter((rule: any) => (status === 'active' ? rule.enabled : status === 'inactive' ? !rule.enabled : true))

  const today = new Date().toISOString().slice(0, 10)
  const logsToday = (logs as any[]).filter((item: any) => item.createdAt.toISOString().slice(0, 10) === today)
  const lastError = (logs as any[]).find((item: any) => item.status === 'FAILED')

  return NextResponse.json({
    canEdit: access.canEdit,
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
      rulesWithAlerts: rules.filter((item: any) => (!item.notifyAuthor && !item.notifyApproverGroup && !item.notifyQualityReviewers && !item.notifyOwnerDepartment && !item.notifyOwnerCostCenter && !item.notifyDistributionTargets && !Array.isArray(item.fixedEmailsJson))).length,
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
      recipientOrigin: item.recipientOrigin,
      status: item.status,
      error: item.error,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const access = await checkAccess(Action.UPDATE)
  if (!access) return NextResponse.json({ error: 'Sem permissão para editar notificações.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as any
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

  if (!payload.event) return NextResponse.json({ error: 'Evento é obrigatório.' }, { status: 400 })

  const defaults = getRuleDefaults(payload.event)
  const subjectTemplate = payload.subjectTemplate || defaults.subjectTemplate
  const bodyTemplate = payload.bodyTemplate || defaults.bodyTemplate

  const existing = await prisma.documentNotificationRule.findFirst({
    where: { event: payload.event, documentTypeId: payload.documentTypeId, flowItemId: payload.flowItemId },
  })

  const saved = existing
    ? await prisma.documentNotificationRule.update({ where: { id: existing.id }, data: { ...payload, subjectTemplate, bodyTemplate } })
    : await prisma.documentNotificationRule.create({ data: { ...defaults, ...payload, subjectTemplate, bodyTemplate } })

  return NextResponse.json({ ok: true, rule: saved })
}

export async function POST(req: NextRequest) {
  const access = await checkAccess(Action.UPDATE)
  if (!access) return NextResponse.json({ error: 'Sem permissão para envio de teste.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as any

  if (body?.mode === 'preview') {
    const preview = await previewDocumentNotification(body.event, {
      documentId: body.documentId,
      versionId: body.versionId || null,
      flowItemId: body.flowItemId || null,
    })
    return NextResponse.json(preview)
  }

  if (body?.mode === 'test') {
    const response = await sendDocumentNotification(body.event, {
      documentId: body.documentId,
      versionId: body.versionId || null,
      flowItemId: body.flowItemId || null,
    })
    return NextResponse.json(response, { status: response.ok ? 200 : 500 })
  }

  return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
}
