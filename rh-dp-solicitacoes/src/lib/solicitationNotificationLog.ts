import { prisma } from '@/lib/prisma'
import { sendMail, type MailChannel, type MailPayload, type MailResult } from '@/lib/mailer'

export type LoggedSolicitationMailInput = MailPayload & {
  solicitationId?: string | null
  workflowId?: string | null
  stepKey?: string | null
  event: string
  recipientUserId?: string | null
  recipientSource?: string | null
  channel?: MailChannel
}

function preview(input: LoggedSolicitationMailInput) {
  return (input.text || input.html || '').slice(0, 500)
}

export async function sendSolicitationMailWithLog(input: LoggedSolicitationMailInput): Promise<MailResult> {
  const result = await sendMail(input, input.channel ?? 'NOTIFICATIONS')
  await Promise.all(input.to.map((recipientEmail) => prisma.solicitationNotificationLog.create({ data: { solicitationId: input.solicitationId ?? null, workflowId: input.workflowId ?? null, stepKey: input.stepKey ?? null, event: input.event, recipientEmail, recipientUserId: input.recipientUserId ?? null, recipientSource: input.recipientSource ?? null, subject: input.subject, bodyPreview: preview(input), status: result.sent ? 'SENT' : 'ERROR', provider: result.provider, error: result.error, sentAt: result.sent && result.provider !== 'dev' ? new Date() : null } })))
  return result
}
