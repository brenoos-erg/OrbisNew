import type { DocumentNotificationEvent } from '@/lib/documents/documentNotificationTypes'
import {
  DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES,
  DOCUMENT_NOTIFICATION_EVENT_LABELS,
} from '@/lib/documents/documentNotificationTypes'
import { resolveDocumentNotificationRecipients } from '@/lib/documents/documentNotificationRecipients'
import { renderDocumentNotificationTemplate } from '@/lib/documents/documentNotificationTemplate'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'

type NotificationContext = {
  documentId: string
  versionId?: string | null
  flowItemId?: string | null
  ruleId?: string | null
  actorUserId?: string | null
  comment?: string | null
}

async function getRule(event: DocumentNotificationEvent, documentTypeId?: string | null, flowItemId?: string | null) {
  return prisma.documentNotificationRule.findFirst({
    where: {
      enabled: true,
      event,
      OR: [
        { documentTypeId: documentTypeId ?? null, flowItemId: flowItemId ?? null },
        { documentTypeId: documentTypeId ?? null, flowItemId: null },
        { documentTypeId: null, flowItemId: null },
      ],
    },
    orderBy: [{ flowItemId: 'desc' }, { documentTypeId: 'desc' }, { createdAt: 'asc' }],
  })
}

async function buildTemplateVariables(context: NotificationContext, event: DocumentNotificationEvent) {
  const version = context.versionId
    ? await prisma.documentVersion.findUnique({
        where: { id: context.versionId },
        include: {
          document: {
            include: {
              author: { select: { fullName: true } },
              documentType: { select: { description: true } },
              ownerDepartment: { select: { name: true } },
              ownerCostCenter: { select: { description: true, code: true } },
            },
          },
        },
      })
    : null

  const document =
    version?.document ??
    (await prisma.isoDocument.findUnique({
      where: { id: context.documentId },
      include: {
        author: { select: { fullName: true } },
        documentType: { select: { description: true } },
        ownerDepartment: { select: { name: true } },
        ownerCostCenter: { select: { description: true, code: true } },
      },
    }))

  if (!document) return null

  const flowItem = context.flowItemId
    ? await prisma.documentTypeApprovalFlow.findUnique({
        where: { id: context.flowItemId },
        include: { approverGroup: { select: { name: true } } },
      })
    : null

  return {
    document,
    version,
    values: {
      documentCode: document.code,
      documentTitle: document.title,
      revisionNumber: version ? `REV${String(version.revisionNumber).padStart(2, '0')}` : '-',
      status: version?.status ?? '-',
      event: DOCUMENT_NOTIFICATION_EVENT_LABELS[event],
      authorName: document.author.fullName ?? '-',
      documentType: document.documentType.description,
      ownerDepartment: document.ownerDepartment?.name ?? '-',
      ownerCostCenter: document.ownerCostCenter
        ? [document.ownerCostCenter.code, document.ownerCostCenter.description].filter(Boolean).join(' - ')
        : '-',
      approvalStep: flowItem ? `Etapa ${flowItem.order}` : '-',
      approverGroup: flowItem?.approverGroup.name ?? '-',
      link: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/dashboard/controle-documentos/visualizacao/${version?.id ?? ''}`,
      createdAt: document.createdAt.toLocaleString('pt-BR'),
      publishedAt: version?.publishedAt?.toLocaleString('pt-BR') ?? '-',
      expiresAt: version?.expiresAt?.toLocaleString('pt-BR') ?? '-',
    },
  }
}

export async function previewDocumentNotification(event: DocumentNotificationEvent, context: NotificationContext) {
  const version = context.versionId
    ? await prisma.documentVersion.findUnique({ where: { id: context.versionId }, select: { document: { select: { documentTypeId: true } } } })
    : null
  const docTypeId = version?.document.documentTypeId ?? null
  const rule = await getRule(event, docTypeId, context.flowItemId)
  const vars = await buildTemplateVariables(context, event)
  if (!vars) return { error: 'Documento não encontrado.' }

  const template = rule
    ? { subject: rule.subjectTemplate, body: rule.bodyTemplate }
    : DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES[event]

  const recipients = await resolveDocumentNotificationRecipients({
    documentId: context.documentId,
    versionId: context.versionId,
    flowItemId: context.flowItemId,
    notifyAuthor: rule?.notifyAuthor ?? true,
    notifyApproverGroup: rule?.notifyApproverGroup ?? false,
    notifyQualityReviewers: rule?.notifyQualityReviewers ?? false,
    notifyOwnerDepartment: rule?.notifyOwnerDepartment ?? false,
    notifyOwnerCostCenter: rule?.notifyOwnerCostCenter ?? false,
    notifyDistributionTargets: rule?.notifyDistributionTargets ?? false,
    fixedEmails: (rule?.fixedEmailsJson as string[] | null) ?? [],
  })

  return {
    event,
    rule,
    recipients,
    subject: renderDocumentNotificationTemplate(template.subject, vars.values),
    body: renderDocumentNotificationTemplate(template.body, vars.values),
  }
}

export async function sendDocumentNotification(event: DocumentNotificationEvent, context: NotificationContext) {
  try {
    const preview = await previewDocumentNotification(event, context)
    if ('error' in preview) return { ok: false, error: preview.error }

    const to = preview.recipients.recipients.map((item) => item.email)
    if (to.length === 0) {
      await prisma.documentNotificationLog.create({
        data: {
          documentId: context.documentId,
          versionId: context.versionId ?? null,
          event,
          ruleId: preview.rule?.id ?? null,
          recipientEmail: '-',
          recipientUserId: null,
          recipientOrigin: 'fixedEmails',
          status: 'SKIPPED',
          error: 'Sem destinatários finais para envio.',
        },
      })
      return { ok: false, skipped: true }
    }

    const result = await sendMail({ to, subject: preview.subject, text: preview.body }, 'NOTIFICATIONS')

    await prisma.documentNotificationLog.createMany({
      data: preview.recipients.recipients.map((recipient) => ({
        documentId: context.documentId,
        versionId: context.versionId ?? null,
        event,
        ruleId: preview.rule?.id ?? null,
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        recipientOrigin: recipient.origin,
        status: result.sent ? 'SENT' : 'FAILED',
        error: result.sent ? null : result.error ?? 'Falha desconhecida',
        sentAt: result.sent ? new Date() : null,
      })),
    })

    return { ok: result.sent, error: result.error ?? null }
  } catch (error) {
    console.error('sendDocumentNotification error', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}
