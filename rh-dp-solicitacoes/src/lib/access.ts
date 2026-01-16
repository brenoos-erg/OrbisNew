// src/lib/access.ts
import { ModuleLevel } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { getModuleKeyAliases, normalizeModuleKey } from '@/lib/moduleKey'

export type AuthenticatedUser = Awaited<ReturnType<typeof requireActiveUser>>

/**
 * Carrega o nível do usuário para um módulo.
 * Ex.: moduleKey = 'solicitacoes' | 'configuracoes'
 */
export async function getUserModuleLevel(
  userId: string,
  moduleKey: string,
): Promise<ModuleLevel | null> {
  const { levels } = await getUserModuleContext(userId)
  const normalizedKey = normalizeModuleKey(moduleKey)

  const directLevel = levels[normalizedKey]
  if (directLevel) {
    return directLevel
  }

  const aliases = getModuleKeyAliases(moduleKey).filter((alias) => alias !== normalizedKey)
  for (const alias of aliases) {
    const level = levels[alias]
    if (level) {
      console.warn('Module key alias aplicado para acesso.', {
        moduleKey,
        normalizedKey,
        aliasUsed: alias,
      })
      return level
    }
  }

  return null
}

/**
 * Garante que o usuário tenha pelo menos um certo nível.
 * Ordem: NIVEL_1 < NIVEL_2 < NIVEL_3
 * Se não tiver, lança Error.
 */
export async function assertUserMinLevel(
  userId: string,
  moduleKey: string,
  minLevel: ModuleLevel,
) {
  const { levels } = await getUserModuleContext(userId)
  const normalizedKey = normalizeModuleKey(moduleKey)
  let level = levels[normalizedKey]

  if (!level) {
    const aliases = getModuleKeyAliases(moduleKey).filter((alias) => alias !== normalizedKey)
    for (const alias of aliases) {
      if (levels[alias]) {
        level = levels[alias]
        console.warn('Module key alias aplicado ao validar nível mínimo.', {
          moduleKey,
          normalizedKey,
          aliasUsed: alias,
        })
        break
      }
    }
  }

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

/**
 * Wrapper genérico para rotas de API:
 *
 * export const POST = withModuleLevel('solicitacoes', ModuleLevel.NIVEL_3, async (req, ctx, me) => {
 *   // aqui dentro já está autenticado + autorizado
 * })
 */
export function withModuleLevel<
  TContext extends { params?: any } = { params?: any },
  TRequest extends Request = Request,
>(
  moduleKey: string,
  minLevel: ModuleLevel,
  handler: (
    req: TRequest,
    ctx: TContext & { me: AuthenticatedUser },
  ) => Promise<Response>,
) {
  return async (req: TRequest, ctx: TContext): Promise<Response> => {
    try {
      // 1) usuário logado
      const me = await requireActiveUser()

      // 2) checa nível mínimo
      await assertUserMinLevel(me.id, moduleKey, minLevel)

      // 3) chama o handler original, já com "me" no contexto
      return handler(req, { ...ctx, me })
    } catch (err: any) {
      console.error('withModuleLevel error', err)

      if (err instanceof Error && err.message.includes('permissão')) {
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (err instanceof Error && err.message.includes('módulo')) {
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(
        JSON.stringify({ error: 'Erro de autorização.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  }
}
