import { prisma } from '@/lib/prisma'

const DEFAULT_SUBJECT = 'NC {{numeroRnc}}: ação necessária'
const DEFAULT_BODY = [
  'Foi registrada uma não conformidade no sistema.',
  '',
  'Número: {{numeroRnc}}',
  'Descrição: {{descricao}}',
  'Responsável: {{responsavel}}',
  'Data: {{data}}',
  'Status: {{status}}',
].join('\n')

export async function ensureNonConformityAlertConfig() {
  const existing = await prisma.nonConformityAlertConfig.findFirst({
    include: { recipients: { where: { active: true }, orderBy: { email: 'asc' } } },
  })
  if (existing) return existing

  return prisma.nonConformityAlertConfig.create({
    data: {
      subjectTemplate: DEFAULT_SUBJECT,
      bodyTemplate: DEFAULT_BODY,
      eventCreatedEnabled: true,
      eventUpdatedEnabled: false,
    },
    include: { recipients: { where: { active: true }, orderBy: { email: 'asc' } } },
  })
}

export function renderNcAlertTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] ?? '')
}