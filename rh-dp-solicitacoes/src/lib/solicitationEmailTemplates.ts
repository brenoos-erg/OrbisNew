export const DEFAULT_SOLICITATION_EMAIL_TEMPLATE = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

const PLACEHOLDER_REGEX = /\{(protocolo|tipoCodigo|tipoNome|solicitante|departamentoAtual|link)\}/g

export const SOLICITATION_EMAIL_PLACEHOLDERS = [
  '{protocolo}',
  '{tipoCodigo}',
  '{tipoNome}',
  '{solicitante}',
  '{departamentoAtual}',
  '{link}',
] as const

export function resolveTemplate(template?: { subject?: string; body?: string } | null) {
  return {
    subject: template?.subject?.trim() || DEFAULT_SOLICITATION_EMAIL_TEMPLATE.subject,
    body: template?.body?.trim() || DEFAULT_SOLICITATION_EMAIL_TEMPLATE.body,
  }
}

export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(PLACEHOLDER_REGEX, (_, key: string) => values[key] ?? '')
}

export function normalizeAndValidateEmails(emails: string[]) {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return Array.from(new Set((emails ?? []).map((email) => email?.trim()).filter(Boolean)))
    .filter((email): email is string => Boolean(email && EMAIL_REGEX.test(email)))
}