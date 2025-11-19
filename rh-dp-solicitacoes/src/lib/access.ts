// src/lib/access.ts
import { prisma } from '@/lib/prisma'
import { ModuleLevel } from '@prisma/client'

/**
 * Carrega o nível que o usuário tem em um módulo específico.
 * Ex.: moduleKey = 'solicitacoes' | 'configuracoes'
 */
export async function getUserModuleLevel(
  userId: string,
  moduleKey: string,
): Promise<ModuleLevel | null> {
  const access = await prisma.userModuleAccess.findFirst({
    where: {
      userId,
      module: { key: moduleKey },
    },
    include: {
      module: true,
    },
  })

  return access?.level ?? null
}

/**
 * Garante que o usuário tenha pelo menos um certo nível
 * (NIVEL_1 < NIVEL_2 < NIVEL_3).
 * Se não tiver, dispara erro.
 */
export async function assertUserMinLevel(
  userId: string,
  moduleKey: string,
  minLevel: ModuleLevel,
) {
  const level = await getUserModuleLevel(userId, moduleKey)

  if (!level) {
    throw new Error('Usuário não possui acesso a este módulo.')
  }

  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  const userIndex = order.indexOf(level)
  const minIndex = order.indexOf(minLevel)

  if (userIndex < 0 || userIndex < minIndex) {
    throw new Error('Usuário não possui permissão suficiente.')
  }
}
