import { prisma } from '@/lib/prisma'
import { renderNcAlertTemplate } from '@/lib/sst/nonConformityAlertTemplate'

const DEFAULT_SUBJECT = 'NC {{numeroRnc}}: atualização registrada'
export const LEGACY_RESPONSIBLE_TEMPLATE_LINE = 'Responsável: {{responsavel}}'
export const SAFE_REASON_TEMPLATE_LINE = 'Motivo do envio: {{motivoEnvio}}'

const DEFAULT_BODY = [
  'Foi registrada uma não conformidade no sistema.',
  '',
  'Número: {{numeroRnc}}',
  'Descrição: {{descricao}}',
  SAFE_REASON_TEMPLATE_LINE,
  'Data: {{data}}',
  'Status: {{status}}',
].join('\n')

export function normalizeNonConformityAlertBodyTemplate(bodyTemplate: string) {
  return bodyTemplate.replaceAll(LEGACY_RESPONSIBLE_TEMPLATE_LINE, SAFE_REASON_TEMPLATE_LINE)
}

export async function ensureNonConformityAlertConfig() {
  const existing = await prisma.nonConformityAlertConfig.findFirst({
    include: { recipients: { where: { active: true }, orderBy: { email: 'asc' } } },
  })
  if (existing) {
    const normalizedBodyTemplate = normalizeNonConformityAlertBodyTemplate(existing.bodyTemplate)
    if (normalizedBodyTemplate === existing.bodyTemplate) return existing

    return prisma.nonConformityAlertConfig.update({
      where: { id: existing.id },
      data: { bodyTemplate: normalizedBodyTemplate },
      include: { recipients: { where: { active: true }, orderBy: { email: 'asc' } } },
    })
  }

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

export { renderNcAlertTemplate }