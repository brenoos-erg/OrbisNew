import { Prisma, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuthLookupUser = {
  id: string
  email: string
  login: string | null
  passwordHash: string | null
  status: UserStatus
  mustChangePassword: boolean
}

export function normalizeIdentifier(raw: unknown) {
  return String(raw ?? '').trim().toLowerCase()
}

export async function findUserByIdentifier(identifier: string): Promise<AuthLookupUser | null> {
  if (!identifier) return null

  const rows = await prisma.$queryRaw<AuthLookupUser[]>(
    identifier.includes('@')
      ? Prisma.sql`
        SELECT id, email, login, passwordHash, status, mustChangePassword
        FROM \`User\`
        WHERE LOWER(email) = ${identifier}
        LIMIT 1
      `
      : Prisma.sql`
        SELECT id, email, login, passwordHash, status, mustChangePassword
        FROM \`User\`
        WHERE LOWER(login) = ${identifier}
        LIMIT 1
      `,
  )

  return rows[0] ?? null
}