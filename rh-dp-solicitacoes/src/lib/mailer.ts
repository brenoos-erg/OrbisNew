// src/lib/mailer.ts
import nodemailer from 'nodemailer'

export type MailPayload = {
  to: string[]        // sempre array, mesmo que só 1 email
  subject: string
  text?: string
  html?: string
}

export type MailResult = {
  sent: boolean
  error?: string
}

// Transporter global (reutilizado entre chamadas)
const transporterPromise = (async () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    NODE_ENV,
  } = process.env

  // Modo DEV sem SMTP configurado: só loga
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    console.warn(
      '[mailer] SMTP não configurado. E-mails serão apenas LOGADOS no console.',
    )
    return null
  }

  const port = Number(SMTP_PORT)

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = TLS/STARTTLS
    auth:
      SMTP_USER && SMTP_PASS
        ? {
            user: SMTP_USER,
            pass: SMTP_PASS,
          }
        : undefined,
  })

  // Opcional: verificar conexão no startup (só em dev)
  if (NODE_ENV !== 'production') {
    try {
      await transporter.verify()
      console.log('[mailer] Conectado ao servidor SMTP com sucesso.')
    } catch (err) {
      console.error('[mailer] Erro ao verificar SMTP:', err)
    }
  }

  return transporter
})()

export async function sendMail({
  to,
  subject,
  text,
  html,
}: MailPayload): Promise<MailResult> {
  try {
    const transporter = await transporterPromise

    // Se não tiver transporter (SMTP não configurado), apenas loga
    if (!transporter) {
      console.log('-----------------------------')
      console.log('📨 [DEV] Simulando envio de e-mail')
      console.log('Para:', to.join(', '))
      console.log('Assunto:', subject)
      if (text) {
        console.log('\nTexto:\n', text)
      }
      if (html) {
        console.log('\nHTML:\n', html)
      }
      console.log('-----------------------------')
      return { sent: true }
    }

    const from = process.env.SMTP_FROM!

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    })

    return { sent: true }
  } catch (error) {
    console.error('[mailer] Erro ao enviar e-mail:', error)
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
