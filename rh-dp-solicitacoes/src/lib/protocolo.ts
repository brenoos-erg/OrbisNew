import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type ProtocolTx = PrismaClient | Prisma.TransactionClient

export async function nextSolicitationProtocolo(tx?: ProtocolTx): Promise<string> {
  const year = new Date().getFullYear()

  const run = async (client: ProtocolTx) => {
    const row = await client.protocolSequence.upsert({
      where: { year },
      update: { lastNumber: { increment: 1 } },
      create: { year, lastNumber: 1 },
    })

    return `RQ${year}-${String(row.lastNumber).padStart(5, '0')}`
  }

  if (tx) {
    return run(tx)
  }

  return prisma.$transaction(async (transaction) => run(transaction))
}