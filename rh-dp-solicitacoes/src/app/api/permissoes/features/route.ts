export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { normalizeModuleKey } from '@/lib/normalizeModules'
import { assertCanFeature, mapLevelToDefaultActions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { withRequestMetrics } from '@/lib/request-metrics'


function normalizeActionList(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return []
  return actions
    .map((item) => (typeof item === 'string' ? item.toUpperCase() : ''))
    .filter((item): item is Action =>
      ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'].includes(item as Action),
    )
}

export async function GET(req: NextRequest) {
  return withRequestMetrics('GET /api/permissoes/features', async () => {
    try {
      const me = await requireActiveUser()
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
      await assertCanFeature(
        me.id,
        MODULE_KEYS.CONFIGURACOES,
        FEATURE_KEYS.CONFIGURACOES.PERMISSOES,
        Action.VIEW,
      )

      const url = new URL(req.url)
      const moduleKey = url.searchParams.get('moduleKey')
      const moduleId = url.searchParams.get('moduleId')

      // 1) fluxo por moduleId
      if (moduleId) {
        const module = await prisma.module.findUnique({
          where: { id: moduleId },
          select: { id: true, key: true, name: true },
        })

        if (!module) {
          return NextResponse.json({ error: 'Módulo não encontrado.' }, { status: 404 })
        }
        const normalizedModuleKey = normalizeModuleKey(module.key || module.name)
        const allModules = await prisma.module.findMany({
          select: { id: true, key: true, name: true },
        })

        const matchingModules = allModules.filter(
          (candidate) =>
            normalizeModuleKey(candidate.key) === normalizedModuleKey ||
            normalizeModuleKey(candidate.name) === normalizedModuleKey,
        )

        const moduleIds = matchingModules.length > 0 ? matchingModules.map((item) => item.id) : [module.id]
        let featureModuleId = module.id

        if (moduleIds.length > 1) {
          const featureCounts = await prisma.moduleFeature.groupBy({
            by: ['moduleId'],
            where: { moduleId: { in: moduleIds } },
            _count: { _all: true },
          })

          const countMap = new Map(featureCounts.map((item) => [item.moduleId, item._count._all]))

          const preferred = matchingModules.find((candidate) => candidate.id === module.id) ?? matchingModules[0]

          const best = matchingModules.reduce((winner, candidate) => {
            const winnerCount = countMap.get(winner.id) ?? 0
            const candidateCount = countMap.get(candidate.id) ?? 0

            if (candidateCount > winnerCount) return candidate
            if (
              candidateCount === winnerCount &&
              candidate.key.toLowerCase() === preferred.key.toLowerCase()
            ) {
              return candidate
            }
            return winner
          }, preferred)

          featureModuleId = best.id
        }


        const [features, levelGrants] = await Promise.all([
          prisma.moduleFeature.findMany({
            where: { moduleId: featureModuleId },
            select: { id: true, key: true, name: true },
            orderBy: { name: 'asc' },
          }),
          prisma.featureLevelGrant.findMany({
            where: { feature: { moduleId: featureModuleId } },
            select: {
              id: true,
              featureId: true,
              level: true,
              actions: { select: { action: true } },
            },
          }),
        ])

        const levels: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
        const grantsByKey = new Map(
          levelGrants.map((g) => [
            `${g.featureId}-${g.level}`,
            {
              ...g,
              actions: g.actions.map((item) => item.action),
            },
          ]),
        )

        const resolvedGrants = features.flatMap((feature) =>
          levels.map((level) => {
            const existing = grantsByKey.get(`${feature.id}-${level}`)
            return (
              existing ?? {
                id: `${feature.id}-${level}`,
                featureId: feature.id,
                level,
                actions: mapLevelToDefaultActions(level),
              }
            )
          }),
        )

        return NextResponse.json({
          module,
          features,
          levelGrants: resolvedGrants,
        })
      }

      // 2) fluxo por moduleKey
      if (moduleKey) {
        const moduleKeyLower = moduleKey.toLowerCase()
        const normalizedModuleKey = normalizeModuleKey(moduleKey)

        const allModules = await prisma.module.findMany({
          select: { id: true, key: true, name: true },
        })

        const matchingModules = allModules.filter(
          (candidate) =>
            normalizeModuleKey(candidate.key) === normalizedModuleKey ||
            normalizeModuleKey(candidate.name) === normalizedModuleKey,
        )

        if (matchingModules.length === 0) {
          return NextResponse.json({ error: 'Módulo não encontrado.' }, { status: 404 })
        }

        let module =
          matchingModules.find((candidate) => candidate.key.toLowerCase() === moduleKeyLower) ??
          matchingModules[0]

        // Desambiguação: se tiver mais de um match, escolhe o que tem mais features;
        // em empate, prefere o que o "key" bate exatamente (case-insensitive).
        if (matchingModules.length > 1) {
          const featureCounts = await prisma.moduleFeature.groupBy({
            by: ['moduleId'],
            where: { moduleId: { in: matchingModules.map((c) => c.id) } },
            _count: { _all: true },
          })

          const countMap = new Map(featureCounts.map((item) => [item.moduleId, item._count._all]))

          module = matchingModules.reduce((best, candidate) => {
            const bestCount = countMap.get(best.id) ?? 0
            const candidateCount = countMap.get(candidate.id) ?? 0

            if (candidateCount > bestCount) return candidate
            if (candidateCount === bestCount && candidate.key.toLowerCase() === moduleKeyLower) {
              return candidate
            }
            return best
          }, module)
        }

        const [features, levelGrants] = await Promise.all([
          prisma.moduleFeature.findMany({
            where: { moduleId: module.id },
            select: { id: true, key: true, name: true },
            orderBy: { name: 'asc' },
          }),
          prisma.featureLevelGrant.findMany({
            where: { feature: { moduleId: module.id } },
             select: {
              id: true,
              featureId: true,
              level: true,
              actions: { select: { action: true } },
            },
          }),
        ])

        const levels: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
        const grantsByKey = new Map(
          levelGrants.map((g) => [
            `${g.featureId}-${g.level}`,
            {
              ...g,
              actions: g.actions.map((item) => item.action),
            },
          ]),
        )

        const resolvedGrants = features.flatMap((feature) =>
          levels.map((level) => {
            const existing = grantsByKey.get(`${feature.id}-${level}`)
            return (
              existing ?? {
                id: `${feature.id}-${level}`,
                featureId: feature.id,
                level,
                actions: mapLevelToDefaultActions(level),
              }
            )
          }),
        )

        return NextResponse.json({
          module,
          features,
          levelGrants: resolvedGrants,
        })
      }

      // 3) nenhum parâmetro
      return NextResponse.json({ error: 'moduleId ou moduleKey é obrigatório.' }, { status: 400 })
    } catch (e: any) {
      console.error('GET /api/permissoes/features error', e)

      if (e instanceof Error && e.message.includes('Acesso negado')) {
        return NextResponse.json({ error: e.message }, { status: 403 })
      }

      return NextResponse.json({ error: 'Erro ao carregar permissões por submódulo.' }, { status: 500 })
    }
  })
}

export async function PATCH(req: NextRequest) {
  return withRequestMetrics('PATCH /api/permissoes/features', async () => {
    try {
      const me = await requireActiveUser()
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
      await assertCanFeature(
        me.id,
        MODULE_KEYS.CONFIGURACOES,
        FEATURE_KEYS.CONFIGURACOES.PERMISSOES,
        Action.UPDATE,
      )

      const body = await req.json().catch(() => ({}))
      const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : ''
      const level = body.level as ModuleLevel | undefined
      const actions = normalizeActionList(body.actions)

      const validLevels: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

      if (!featureKey || !level || !validLevels.includes(level)) {
        return NextResponse.json({ error: 'featureKey e level válidos são obrigatórios.' }, { status: 400 })
      }

      const normalizedFeatureKey = featureKey.toUpperCase()

      const feature = await prisma.moduleFeature.findFirst({
        where: { key: { equals: normalizedFeatureKey } },
        select: { id: true, key: true },
      })

      if (!feature) {
        return NextResponse.json({ error: 'Submódulo não encontrado.' }, { status: 404 })
      }

      const levelGrant = await prisma.featureLevelGrant.upsert({
        where: {
          featureId_level: {
            featureId: feature.id,
            level,
          },
        },
        update: {
          actions: {
            deleteMany: {},
            create: actions.map((action) => ({ action })),
          },
        },
        create: {
          featureId: feature.id,
          level,
          actions: {
            create: actions.map((action) => ({ action })),
          },
        },
        select: {
          id: true,
          featureId: true,
          level: true,
          actions: { select: { action: true } },
        },
      })
      return NextResponse.json({
        ok: true,
        levelGrant: {
          ...levelGrant,
          actions: levelGrant.actions.map((item) => item.action),
         },
      })
    } catch (e: any) {
      console.error('PATCH /api/permissoes/features error', e)

      if (e instanceof Error && e.message.includes('Acesso negado')) {
        return NextResponse.json({ error: e.message }, { status: 403 })
      }

      return NextResponse.json({ error: 'Erro ao salvar permissões.' }, { status: 500 })
    }
  })
}
