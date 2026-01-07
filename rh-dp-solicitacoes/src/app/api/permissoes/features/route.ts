import { NextRequest, NextResponse } from 'next/server'

import { Action, ModuleLevel } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { normalizeModuleKey } from '@/lib/normalizeModules'
import { assertCanFeature, mapLevelToDefaultActions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

function normalizeActionList(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return []
  return actions
    .map((item) => (typeof item === 'string' ? item.toUpperCase() : ''))
    .filter((item): item is Action => ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'].includes(item as Action))
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)

    const url = new URL(req.url)
    const moduleKey = url.searchParams.get('moduleKey')

    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey é obrigatório.' }, { status: 400 })
    }

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
      matchingModules.find((candidate) => candidate.key.toLowerCase() === moduleKey.toLowerCase()) ??
      matchingModules[0]

    if (matchingModules.length > 1) {
      const featureCounts = await prisma.moduleFeature.groupBy({
        by: ['moduleId'],
        where: { moduleId: { in: matchingModules.map((candidate) => candidate.id) } },
        _count: { _all: true },
      })
      const countMap = new Map(featureCounts.map((item) => [item.moduleId, item._count._all]))
      module = matchingModules.reduce((best, candidate) => {
        const bestCount = countMap.get(best.id) ?? 0
        const candidateCount = countMap.get(candidate.id) ?? 0
        if (candidateCount > bestCount) return candidate
        if (candidateCount === bestCount && candidate.key.toLowerCase() === moduleKey.toLowerCase()) {
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
        select: { id: true, featureId: true, level: true, actions: true },
      }),
    ])

    const levels: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
    const grantsByKey = new Map(levelGrants.map((grant) => [`${grant.featureId}-${grant.level}`, grant]))
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
  } catch (e: any) {
    console.error('GET /api/permissoes/features error', e)

    if (e instanceof Error && e.message.includes('Acesso negado')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json({ error: 'Erro ao carregar permissões por submódulo.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

    const body = await req.json().catch(() => ({}))
    const level = body.level as ModuleLevel | undefined
    const featureKey = body.featureKey as string | undefined
    const actions = normalizeActionList(body.actions)

    if (!level || !featureKey) {
      return NextResponse.json({ error: 'level e featureKey são obrigatórios.' }, { status: 400 })
    }

    if (!['NIVEL_1', 'NIVEL_2', 'NIVEL_3'].includes(level)) {
      return NextResponse.json({ error: 'Nível inválido.' }, { status: 400 })
    }

    const feature = await prisma.moduleFeature.findFirst({
      where: {
        key: { equals: featureKey, mode: 'insensitive' },
      },
      select: { id: true },
    })


    if (!feature) {
      return NextResponse.json({ error: 'Submódulo não encontrado.' }, { status: 404 })
    }

    const grant = await prisma.featureLevelGrant.upsert({
      where: { featureId_level: { featureId: feature.id, level } },
      update: { actions },
      create: { featureId: feature.id, level, actions },
      select: { id: true, featureId: true, level: true, actions: true },
    })

    return NextResponse.json(grant)
  } catch (e: any) {
    console.error('PATCH /api/permissoes/features error', e)

    if (e instanceof Error && e.message.includes('Acesso negado')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json({ error: 'Erro ao salvar permissões por submódulo.' }, { status: 500 })
  }
}