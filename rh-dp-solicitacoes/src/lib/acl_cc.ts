// src/lib/acl_cc.ts
import { prisma } from '@/lib/prisma'
import { can } from './acl'

export async function canForCostCenter(userId: string, costCenterId: string, moduleKey: string, action: string) {
  // usuário pertence ao CC?
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { costCenterId: true } })
  if (!user?.costCenterId || user.costCenterId !== costCenterId) return false

  // CC possui o módulo?
  const enabled = await prisma.costCenterModule.findFirst({
    where: { costCenterId, module: { key: moduleKey } },
    select: { id: true },
  })
  if (!enabled) return false

  // grupos do usuário permitem a ação?
  return can(userId, moduleKey, action)
}
