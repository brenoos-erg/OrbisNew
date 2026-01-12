import { prisma } from '@/lib/prisma'

// can(userId, 'solicitacoes', 'APPROVE')
export async function can(userId: string, moduleKey: string, action: string) {
  const grant = await prisma.accessGroupGrant.findFirst({
    where: {
      module: { key: moduleKey },
      actions: { has: action as any }, // 👈 força tipo enum
      group: {
        members: {
          some: { userId },
        },
      },
    },
  })

  return !!grant
}