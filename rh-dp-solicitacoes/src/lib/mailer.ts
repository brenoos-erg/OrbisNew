// src/lib/mailer.ts

export type MailPayload = {
  to: string[]
  subject: string
  text?: string
  html?: string
}

export type MailResult = {
  sent: boolean
  error?: string
}

export type MailChannel = 'ALERTS' | 'NOTIFICATIONS' | 'SYSTEM'

type ResendEmailPayload = {
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
}

/**
 * Retorna o "from" por canal.
 * Configure no .env:
 *  MAIL_FROM_ALERTS="ERG Engenharia <alertas@updates.ergengenharia.com.br>"
 *  MAIL_FROM_NOTIFICATIONS="ERG Engenharia <notificacoes@updates.ergengenharia.com.br>"
 *  MAIL_FROM_SYSTEM="ERG Engenharia <sistema@updates.ergengenharia.com.br>"
 */
function getFromByChannel(channel: MailChannel): string {
  const fallback = process.env.MAIL_FROM ?? 'onboarding@resend.dev'

  const map: Record<MailChannel, string | undefined> = {
    ALERTS: process.env.MAIL_FROM_ALERTS,
    NOTIFICATIONS: process.env.MAIL_FROM_NOTIFICATIONS,
    SYSTEM: process.env.MAIL_FROM_SYSTEM,
  }

  return map[channel] ?? fallback
}

function normalizeRecipients(to: string[]): string[] {
  return (to ?? [])
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
}

function assertValidPayload(payload: MailPayload) {
  const to = normalizeRecipients(payload.to)
  if (to.length === 0) throw new Error('Lista de destinatários (to) vazia.')
  if (!payload.subject?.trim()) throw new Error('Assunto (subject) é obrigatório.')
  if (!payload.text?.trim() && !payload.html?.trim()) {
    throw new Error('Informe pelo menos "text" ou "html" no e-mail.')
  }
}

async function sendViaResend(apiKey: string, payload: ResendEmailPayload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `Resend request failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Envia e-mail via Resend.
 * - Em DEV (sem RESEND_API_KEY), apenas loga e retorna { sent: true }.
 * - channel define o FROM (ALERTS/NOTIFICATIONS/SYSTEM).
 */
export async function sendMail(
  payload: MailPayload,
  channel: MailChannel = 'SYSTEM',
): Promise<MailResult> {
  try {
    assertValidPayload(payload)

    const apiKey = process.env.RESEND_API_KEY
    const to = normalizeRecipients(payload.to)
    const subject = payload.subject.trim()
    const text = payload.text?.trim()
    const html = payload.html?.trim()
    const from = getFromByChannel(channel)

    // Fallback DEV / ambiente sem integração
    if (!apiKey) {
      console.info('[DEV] RESEND_API_KEY não encontrada; e-mail não foi enviado.')
      console.info({ channel, from, to, subject, text, html })
      return { sent: true }
    }

    await sendViaResend(apiKey, { from, to, subject, text, html })

    return { sent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erro ao enviar e-mail:', message)
    return { sent: false, error: message }
  }
}
