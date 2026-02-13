import { Prisma } from '@prisma/client'

export async function finalizeSolicitationIfNoPending(
  tx: Prisma.TransactionClient,
  solicitationId: string,
  source: string,
) {
  const pending = await tx.documentAssignment.count({
    where: {
      document: { solicitationId },
      status: { in: ['PENDENTE', 'AGUARDANDO_ASSINATURA'] },
    },
  })

  if (pending > 0) {
    return false
  }

  await tx.solicitation.update({
    where: { id: solicitationId },
    data: {
      status: 'CONCLUIDA',
      dataFechamento: new Date(),
    },
  })

  await tx.solicitationTimeline.create({
    data: {
      solicitationId,
      status: 'CONCLUIDA',
      message: `Solicitação concluída após assinatura do termo (${source}).`,
    },
  })

  return true
}