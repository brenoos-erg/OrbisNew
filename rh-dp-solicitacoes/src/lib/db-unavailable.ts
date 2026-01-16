import { Prisma } from '@prisma/client'

const dbUnavailableCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1011',
  'P1012',
  'P1013',
  'P1017',
  'P2024',
])

export function isDbUnavailableError(error: unknown) {
  if (process.env.SKIP_PRISMA_DB === 'true') {
    return true
  }

  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      dbUnavailableCodes.has(error.code))
  )
}