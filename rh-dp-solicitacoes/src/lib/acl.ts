import { Action } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// can(userId, 'solicitacoes', 'APPROVE')
export async function can(userId: string, moduleKey: string, action: string) {
  const normalizedAction = action.toUpperCase() as Action
  const grant = await prisma.accessGroupGrant.findFirst({
    where: {
      module: { key: moduleKey },
      actions: { some: { action: normalizedAction } },
      group: {
        members: {
          some: { userId },
        },
      },
    },
  })

  return !!grant
}