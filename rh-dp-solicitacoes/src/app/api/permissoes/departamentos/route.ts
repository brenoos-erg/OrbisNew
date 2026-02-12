export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/permissoes/departamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { Action, ModuleLevel } from '@prisma/client'
import { normalizeModuleKey, normalizeModuleLinks, normalizeModules } from '@/lib/normalizeModules'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { withRequestMetrics } from '@/lib/request-metrics'

const CORE_MODULES = [
  { key: 'solicitacoes', name: 'Solicitações' },
  { key: 'configuracoes', name: 'Configurações' },
  { key: 'gestao-de-frotas', name: 'Gestão de Frotas' },
  { key: 'direito-de-recusa', name: 'Direito de Recusa' },
  { key: 'controle-equipamentos-ti', name: 'Controle de Equipamentos TI' },
  { key: 'celular', name: 'Celular' },
]

const CORE_MODULES_TTL_MS = 5 * 60 * 1000
let coreModulesSyncPromise: Promise<void> | null = null
let coreModulesExpiresAt = 0

async function ensureCoreModules() {
  for (const module of CORE_MODULES) {
    // Primeiro tenta o match exato da key para evitar colisões de unique ao normalizar
    const canonical = await prisma.module.findUnique({
      where: { key: module.key },
      select: { id: true },
    })

    if (canonical) {
      await prisma.module.update({
        where: { id: canonical.id },
        data: { name: module.name },
      })
      continue
    }

    // Se não houver, procura uma variação case-insensitive para normalizar com segurança
    const existingVariant = await prisma.module.findFirst({
      where: { key: { equals: module.key } },
      select: { id: true },
    })

    if (existingVariant) {
      await prisma.module.update({
        where: { id: existingVariant.id },
        data: { key: module.key, name: module.name },
      })
      continue
    }
    const normalizedKey = normalizeModuleKey(module.key)
    const candidates = await prisma.module.findMany({
      select: { id: true, key: true, name: true },
    })
    const normalizedMatch = candidates.find(
      (candidate) =>
        normalizeModuleKey(candidate.key) === normalizedKey ||
        normalizeModuleKey(candidate.name) === normalizedKey,
    )
    if (normalizedMatch) {
      await prisma.module.update({
        where: { id: normalizedMatch.id },
        data: { key: module.key, name: module.name },
      })
      continue
    }


    await prisma.module.create({ data: module })
  }
}

function ensureCoreModulesCached() {
  const now = Date.now()

  if (now < coreModulesExpiresAt) {
    return coreModulesSyncPromise ?? Promise.resolve()
  }

  if (!coreModulesSyncPromise) {
    coreModulesSyncPromise = ensureCoreModules().finally(() => {
      coreModulesExpiresAt = Date.now() + CORE_MODULES_TTL_MS
      coreModulesSyncPromise = null
    })
  }

  return coreModulesSyncPromise
}



/**
 * GET /api/permissoes/departamentos
 * Retorna:
 * {
 *   departments: [{ id, code, name }],
 *   modules:     [{ id, key, name }],
 *   links:       [{ departmentId, moduleId }]
 * }
 */
export async function GET(_req: NextRequest) {
  return withRequestMetrics('GET /api/permissoes/departamentos', async () => {
    try {
      const me = await requireActiveUser()
      // 🔐 Só NIVEL_3 no módulo "configuracoes" pode mexer nisso
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
      await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)
      await ensureCoreModulesCached()

      const [departments, modules, links] = await Promise.all([
        prisma.department.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        }),
        prisma.module.findMany({
          select: { id: true, key: true, name: true },
          orderBy: { name: 'asc' },
        }),
        prisma.departmentModule.findMany({
          select: { departmentId: true, moduleId: true },
        }),
      ])

      const normalizedModules = normalizeModules(modules)
      const normalizedLinks = normalizeModuleLinks(links, normalizedModules.idToCanonicalId)

      return NextResponse.json({
        departments,
        modules: normalizedModules.modules,
        links: normalizedLinks,
      })
    } catch (e: any) {
      console.error('GET /api/permissoes/departamentos error', e)

      if (e instanceof Error && e.message.includes('permissão')) {
        return NextResponse.json({ error: e.message }, { status: 403 })
      }

      return NextResponse.json(
        { error: 'Erro ao carregar permissões de departamentos.' },
        { status: 500 },
      )
    }
  })
}
/**
 * POST /api/permissoes/departamentos
 * body: { departmentId: string, moduleId: string, enabled: boolean }
 */
export async function POST(req: NextRequest) {
  return withRequestMetrics('POST /api/permissoes/departamentos', async () => {
    try {
      const me = await requireActiveUser()
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
      await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

      const body = await req.json().catch(() => ({} as any))
      const { departmentId, moduleId, enabled } = body as {
        departmentId?: string
        moduleId?: string
        enabled?: boolean
      }

      if (!departmentId || !moduleId || typeof enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'departmentId, moduleId e enabled são obrigatórios.' },
          { status: 400 },
        )
      }

      if (enabled) {
        // cria se não existir
        const exists = await prisma.departmentModule.findFirst({
          where: { departmentId, moduleId },
        })

        if (!exists) {
          await prisma.departmentModule.create({
            data: { departmentId, moduleId },
          })
        }
      } else {
        // remove o vínculo
        await prisma.departmentModule.deleteMany({
          where: { departmentId, moduleId },
        })
      }
    
      return NextResponse.json({ ok: true })
    } catch (e: any) {
      console.error('POST /api/permissoes/departamentos error', e)

      if (e instanceof Error && e.message.includes('permissão')) {
        return NextResponse.json({ error: e.message }, { status: 403 })
      }

      return NextResponse.json(
        { error: 'Erro ao salvar permissão do departamento.' },
        { status: 500 },
      )
    }
  })
}
