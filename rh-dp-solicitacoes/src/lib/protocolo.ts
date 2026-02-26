import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type ProtocolTx = PrismaClient | Prisma.TransactionClient
type ProtocolSequenceRow = { lastNumber: number }

export async function nextSolicitationProtocolo(tx?: ProtocolTx): Promise<string> {
  const year = new Date().getFullYear()

  const run = async (client: ProtocolTx) => {
    await client.$executeRaw(
      Prisma.sql`
        INSERT INTO ProtocolSequence (year, lastNumber, updatedAt)
        VALUES (${year}, 1, NOW())
        ON DUPLICATE KEY UPDATE
          lastNumber = lastNumber + 1,
          updatedAt = NOW()
      `,
    )

    const rows = await client.$queryRaw<ProtocolSequenceRow[]>(
      Prisma.sql`SELECT lastNumber FROM ProtocolSequence WHERE year = ${year} LIMIT 1`,
    )
    const row = rows[0]

    if (!row) {
      throw new Error(`Falha ao obter a sequência de protocolo para o ano ${year}.`)
    }

    return `RQ${year}-${String(row.lastNumber).padStart(5, '0')}`
  }

  if (tx) {
    return run(tx)
  }

  return prisma.$transaction(async (transaction) => run(transaction))
}