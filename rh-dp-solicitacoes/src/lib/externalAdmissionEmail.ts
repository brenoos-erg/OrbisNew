import { sendMail } from '@/lib/mailer'

export type ExternalAdmissionEmailInput = {
  candidateName: string
  candidateEmail: string
  protocolo: string
  externalUrl: string
  companyName?: string
}

export type ExternalAdmissionEmailResult = {
  sent: boolean
  error: string | null
}

export function resolveCompanyName() {
  return (
    process.env.COMPANY_NAME?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    'RH | Portal de Solicitações'
  )
}

function buildEmailHtml(input: ExternalAdmissionEmailInput) {
  const companyName = input.companyName || resolveCompanyName()

  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
    <p>Olá, <strong>${input.candidateName}</strong>!</p>
    <p>Seu processo de admissão foi iniciado no <strong>${companyName}</strong>.</p>
    <p><strong>Protocolo:</strong> ${input.protocolo}</p>
    <p>Para enviar sua documentação, acesse o checklist no botão abaixo:</p>
    <p style="margin: 24px 0;">
      <a
        href="${input.externalUrl}"
        style="display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700;"
      >
        Acessar checklist de admissão
      </a>
    </p>
    <p>Você pode anexar os documentos diretamente pelo portal (PDF, JPG, PNG, DOC ou DOCX quando suportado).</p>
    <p><strong>Atenção:</strong> o exame ASO não é exigido neste portal.</p>
    <p>Se o botão não abrir, copie e cole este link no navegador:</p>
    <p><a href="${input.externalUrl}">${input.externalUrl}</a></p>
  </div>
  `
}

function buildEmailText(input: ExternalAdmissionEmailInput) {
  const companyName = input.companyName || resolveCompanyName()

  return [
    `Olá, ${input.candidateName}!`,
    '',
    `Seu processo de admissão foi iniciado no ${companyName}.`,
    `Protocolo: ${input.protocolo}`,
    '',
    'Acesse o checklist para enviar os documentos:',
    input.externalUrl,
    '',
    'Você pode anexar os documentos diretamente pelo portal (PDF, JPG, PNG, DOC ou DOCX quando suportado).',
    'Atenção: o exame ASO não é exigido neste portal.',
  ].join('\n')
}

export async function sendExternalAdmissionEmail(
  input: ExternalAdmissionEmailInput,
): Promise<ExternalAdmissionEmailResult> {
  const result = await sendMail(
    {
      to: [input.candidateEmail],
      subject: `Checklist de admissão - Protocolo ${input.protocolo}`,
      text: buildEmailText(input),
      html: buildEmailHtml(input),
    },
    'NOTIFICATIONS',
  )

  if (!result.sent) {
    return { sent: false, error: result.error ?? 'Falha ao enviar e-mail.' }
  }

  return { sent: true, error: null }
}
