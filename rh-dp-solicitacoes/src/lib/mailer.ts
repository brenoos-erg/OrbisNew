const { EMAIL_WEBHOOK_URL = '' } = process.env

export type MailResult = { sent: boolean; error?: string }

type MailPayload = {
  to: string[]
  subject: string
  text: string
}

export async function sendMail({ to, subject, text }: MailPayload): Promise<MailResult> {
  if (!EMAIL_WEBHOOK_URL) {
    console.warn('EMAIL_WEBHOOK_URL não configurado; alerta por e-mail não será enviado.')
    return { sent: false, error: 'Webhook não configurado' }
  }

  try {
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    })

    if (!res.ok) {
      const msg = `Falha ao enviar e-mail (${res.status})`
      console.error(msg)
      return { sent: false, error: msg }
    }

    return { sent: true }
  } catch (error) {
    console.error('Erro ao enviar e-mail', error)
    return { sent: false, error: error instanceof Error ? error.message : String(error) }
  }
}
