import { prisma } from '@/lib/prisma'

// can(userId, 'solicitacoes', 'APPROVE')
export async function can(userId: string, moduleKey: string, action: string) {
  const groups = await prisma.groupMember.findMany({
  where: { userId },
  select: { groupId: true },
}) as { groupId: string }[]

  const grant = await prisma.accessGroupGrant.findFirst({
  where: {
    groupId: { in: groups.map(g => g.groupId) },
    module: { key: moduleKey },
    actions: { has: action as any }, // 👈 força tipo enum
  },
})

  return !!grant
}