import nodemailer from 'nodemailer'

export type SendEmailInput = {
  to: string[]
  subject: string
  text: string
}

export type SendEmailResult = {
  sent: boolean
  provider: 'smtp' | 'console'
  error?: string
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM?.trim(),
  )
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT)
  const secure = process.env.SMTP_SECURE?.toLowerCase() === 'true' || port === 465

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!hasSmtpConfig()) {
    console.info('[emailSender] SMTP não configurado; preview do e-mail:')
    console.info({
      to: input.to,
      subject: input.subject,
      text: input.text,
    })
    return { sent: true, provider: 'console' }
  }

  try {
    const transporter = createTransporter()
    await transporter.verify()
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    })

    return { sent: true, provider: 'smtp' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[emailSender] erro ao enviar e-mail', message)
    return { sent: false, provider: 'smtp', error: message }
  }
}