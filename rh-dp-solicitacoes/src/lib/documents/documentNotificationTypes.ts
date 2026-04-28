export const DOCUMENT_NOTIFICATION_EVENTS = [
  'DOCUMENT_CREATED',
  'DOCUMENT_SUBMITTED_FOR_APPROVAL',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'DOCUMENT_QUALITY_REVIEW',
  'DOCUMENT_PUBLISHED',
  'DOCUMENT_DISTRIBUTED',
  'DOCUMENT_EXPIRING',
  'DOCUMENT_EXPIRED',
] as const

export type DocumentNotificationEvent = (typeof DOCUMENT_NOTIFICATION_EVENTS)[number]

export const DOCUMENT_NOTIFICATION_EVENT_LABELS: Record<DocumentNotificationEvent, string> = {
  DOCUMENT_CREATED: 'Documento cadastrado',
  DOCUMENT_SUBMITTED_FOR_APPROVAL: 'Aguardando aprovação',
  DOCUMENT_APPROVED: 'Documento aprovado',
  DOCUMENT_REJECTED: 'Documento reprovado/devolvido',
  DOCUMENT_QUALITY_REVIEW: 'Revisão da qualidade',
  DOCUMENT_PUBLISHED: 'Documento publicado',
  DOCUMENT_DISTRIBUTED: 'Documento distribuído',
  DOCUMENT_EXPIRING: 'Documento próximo do vencimento',
  DOCUMENT_EXPIRED: 'Documento vencido',
}

export const DOCUMENT_NOTIFICATION_PLACEHOLDERS = [
  '{documentCode}',
  '{documentTitle}',
  '{revisionNumber}',
  '{status}',
  '{event}',
  '{authorName}',
  '{documentType}',
  '{ownerDepartment}',
  '{ownerCostCenter}',
  '{approvalStep}',
  '{approverGroup}',
  '{link}',
  '{createdAt}',
  '{publishedAt}',
  '{expiresAt}',
] as const

export const DOCUMENT_NOTIFICATION_DEFAULT_TEMPLATES: Record<DocumentNotificationEvent, { subject: string; body: string }> = {
  DOCUMENT_CREATED: {
    subject: '[{documentCode}] Documento cadastrado',
    body: 'O documento {documentCode} - {documentTitle} foi cadastrado por {authorName} em {createdAt}. Link: {link}',
  },
  DOCUMENT_SUBMITTED_FOR_APPROVAL: {
    subject: '[{documentCode}] Aguardando aprovação',
    body: 'A revisão {revisionNumber} do documento {documentCode} está aguardando aprovação na etapa {approvalStep} ({approverGroup}). Link: {link}',
  },
  DOCUMENT_APPROVED: {
    subject: '[{documentCode}] Etapa aprovada',
    body: 'A revisão {revisionNumber} do documento {documentCode} foi aprovada na etapa {approvalStep}. Status atual: {status}. Link: {link}',
  },
  DOCUMENT_REJECTED: {
    subject: '[{documentCode}] Ajuste necessário',
    body: 'A revisão {revisionNumber} do documento {documentCode} foi devolvida para ajuste. Status atual: {status}. Link: {link}',
  },
  DOCUMENT_QUALITY_REVIEW: {
    subject: '[{documentCode}] Revisão da qualidade pendente',
    body: 'A revisão {revisionNumber} do documento {documentCode} chegou para Revisão da qualidade. Link: {link}',
  },
  DOCUMENT_PUBLISHED: {
    subject: '[{documentCode}] Documento publicado',
    body: 'O documento {documentCode} - {documentTitle} (REV {revisionNumber}) foi publicado em {publishedAt}. Link: {link}',
  },
  DOCUMENT_DISTRIBUTED: {
    subject: '[{documentCode}] Documento distribuído para ciência',
    body: 'O documento {documentCode} foi distribuído para ciência/leitura. Acompanhe o status pelo link: {link}',
  },
  DOCUMENT_EXPIRING: {
    subject: '[{documentCode}] Documento próximo do vencimento',
    body: 'O documento {documentCode} - {documentTitle} vence em {expiresAt}. Verifique a necessidade de revisão. Link: {link}',
  },
  DOCUMENT_EXPIRED: {
    subject: '[{documentCode}] Documento vencido',
    body: 'O documento {documentCode} - {documentTitle} venceu em {expiresAt}. Providencie a atualização. Link: {link}',
  },
}
