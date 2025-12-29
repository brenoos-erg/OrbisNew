import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type TransactionClient = Prisma.TransactionClient

/**
 * Garante que exista um vínculo na tabela UserDepartment sem criar duplicados.
 * Pode receber um cliente de transação (tx) para reaproveitar a mesma transação.
 */
export async function ensureUserDepartmentLink(
  userId: string,
  departmentId: string,
  tx?: TransactionClient,
) {
  const client = tx ?? prisma

  await client.userDepartment.upsert({
    where: {
      userId_departmentId: {
        userId,
        departmentId,
      },
    },
    update: {},
    create: {
      userId,
      departmentId,
    },
  })
}

/**
 * Remove o vínculo na tabela UserDepartment, caso exista.
 */
export async function removeUserDepartmentLink(
  userId: string,
  departmentId: string,
  tx?: TransactionClient,
) {
  const client = tx ?? prisma

  await client.userDepartment.deleteMany({
    where: { userId, departmentId },
  })
}