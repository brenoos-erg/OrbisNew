// src/lib/mailer.ts

import nodemailer from 'nodemailer'

export type MailPayload = {
  to: string[]
  subject: string
  text?: string
  html?: string
}

export type MailResult = {
  sent: boolean
  provider?: 'smtp' | 'resend' | 'dev'
  error?: string
}

export type MailChannel = 'ALERTS' | 'NOTIFICATIONS' | 'SYSTEM'

type OutboundEmailPayload = {
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
  const fallback =
    process.env.SMTP_FROM ?? process.env.MAIL_FROM ?? 'onboarding@resend.dev'

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

async function sendViaResend(apiKey: string, payload: OutboundEmailPayload) {
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

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const portValue = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS

  if (!host || !portValue || !user || !pass) {
    return null
  }

  const port = Number(portValue)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT inválida. Use um número inteiro positivo.')
  }

  const secureEnv = process.env.SMTP_SECURE?.toLowerCase()
  const secure =
    secureEnv === 'true' || secureEnv === '1'
      ? true
      : secureEnv === 'false' || secureEnv === '0'
      ? false
      : port === 465

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  }
}

async function sendViaSmtp(
  smtpConfig: NonNullable<ReturnType<typeof getSmtpConfig>>,
  payload: OutboundEmailPayload,
) {
  const transporter = nodemailer.createTransport(smtpConfig)
  await transporter.verify()
  await transporter.sendMail(payload)
}

/**
 * Envia e-mail com prioridade SMTP -> Resend -> DEV.
 * - channel define o FROM (ALERTS/NOTIFICATIONS/SYSTEM).
 */
export async function sendMail(
  payload: MailPayload,
  channel: MailChannel = 'SYSTEM',
): Promise<MailResult> {
  try {
    assertValidPayload(payload)

    const apiKey = process.env.RESEND_API_KEY
    const smtpConfig = getSmtpConfig()
    const to = normalizeRecipients(payload.to)
    const subject = payload.subject.trim()
    const text = payload.text?.trim()
    const html = payload.html?.trim()
    const from = getFromByChannel(channel)
    const mailPayload = { from, to, subject, text, html }

    if (smtpConfig) {
      await sendViaSmtp(smtpConfig, mailPayload)
      return { sent: true, provider: 'smtp' }
    }

    if (apiKey) {
      await sendViaResend(apiKey, mailPayload)
      return { sent: true, provider: 'resend' }
    }

    console.info('[DEV] SMTP/RESEND não configurados; e-mail não foi enviado.')
    console.info({ channel, from, to, subject, text, html })
    return { sent: true, provider: 'dev' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erro ao enviar e-mail:', message)
    return { sent: false, error: message }
  }
}
