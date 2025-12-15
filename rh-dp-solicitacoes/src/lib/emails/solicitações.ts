export type SolicitationCreatedEmailArgs = {
  requesterName: string
  approverName: string
  solicitationId: string
  solicitationType: string
}

type SolicitationCreatedEmailContent = {
  subject: string
  text: string
}

export function buildSolicitationCreatedEmailContent({
  requesterName,
  approverName,
  solicitationId,
  solicitationType,
}: SolicitationCreatedEmailArgs): SolicitationCreatedEmailContent {
  const subject = `Nova solicitação criada (${solicitationType})`

  const text = [
    `Olá, ${approverName}!`,
    '',
    `Uma nova solicitação foi criada por ${requesterName}.`,
    `ID da solicitação: ${solicitationId}`,
    `Tipo: ${solicitationType}`,
    '',
    'Acesse o sistema para revisar e aprovar a solicitação.',
  ].join('\n')

  return { subject, text }
}