import { sendMail } from '@/lib/mailer'

export type SendEmailInput = { to: string[]; subject: string; text: string }
export type SendEmailResult = { sent: boolean; provider: 'smtp' | 'resend' | 'dev' | 'console'; error?: string }

/** @deprecated Use sendMail() from '@/lib/mailer'. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const result = await sendMail({ to: input.to, subject: input.subject, text: input.text }, 'NOTIFICATIONS')
  return { sent: result.sent, provider: result.provider ?? 'console', error: result.error }
}
