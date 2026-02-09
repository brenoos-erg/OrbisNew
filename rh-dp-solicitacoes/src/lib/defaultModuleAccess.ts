import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const DEFAULT_MODULE_KEYS = ['solicitacoes', 'direito-de-recusa', 'meus-documentos']

export async function ensureDefaultModuleAccess(
  userId: string,
  moduleKeys: string[] = DEFAULT_MODULE_KEYS,
) {
  if (!userId) return

  const modules = await prisma.module.findMany({
    where: { key: { in: moduleKeys } },
    select: { id: true },
  })

  if (modules.length === 0) return

  await prisma.userModuleAccess.createMany({
    data: modules.map((module) => ({
      userId,
      moduleId: module.id,
      level: ModuleLevel.NIVEL_1,
    })),
    skipDuplicates: true,
  })
}