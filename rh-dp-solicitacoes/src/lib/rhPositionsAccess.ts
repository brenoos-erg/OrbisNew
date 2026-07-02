import { Action } from '@prisma/client'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { userHasRhAccess } from '@/lib/rhAccess'

export async function canAccessRhPositions(
  user: { id: string; role?: string | null; departmentId?: string | null },
  action: Action = Action.VIEW,
) {
  if (user.role === 'ADMIN') return true

  const [hasRhFeature, hasLegacyFeature, hasRhAccess] = await Promise.all([
    canFeature(user.id, MODULE_KEYS.RH, FEATURE_KEYS.RH.CARGOS, action),
    canFeature(user.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.CARGOS, action),
    userHasRhAccess(user),
  ])

  return hasRhFeature || hasLegacyFeature || hasRhAccess
}
