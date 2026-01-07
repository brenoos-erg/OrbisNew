import { NextRequest, NextResponse } from 'next/server'

import { Action, ModuleLevel } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
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

    const module = await prisma.module.findFirst({
      where: { key: { equals: moduleKey, mode: 'insensitive' } },
      select: { id: true, key: true, name: true },
    })

    if (!module) {
      return NextResponse.json({ error: 'Módulo não encontrado.' }, { status: 404 })
    }

    const [features, groups, grants] = await Promise.all([
      prisma.moduleFeature.findMany({
        where: { moduleId: module.id },
        select: { id: true, key: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.accessGroup.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.featureGrant.findMany({
        where: { feature: { moduleId: module.id } },
        select: { id: true, groupId: true, featureId: true, actions: true },
      }),
    ])

    return NextResponse.json({
      module,
      features,
      groups,
      grants,
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
    const groupId = body.groupId as string | undefined
    const featureKey = body.featureKey as string | undefined
    const actions = normalizeActionList(body.actions)

    if (!groupId || !featureKey) {
      return NextResponse.json(
        { error: 'groupId e featureKey são obrigatórios.' },
        { status: 400 },
      )
    }

    const [group, feature] = await Promise.all([
      prisma.accessGroup.findUnique({ where: { id: groupId }, select: { id: true } }),
      prisma.moduleFeature.findFirst({
        where: {
          key: { equals: featureKey, mode: 'insensitive' },
        },
        select: { id: true },
      }),
    ])

    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 })
    }

    if (!feature) {
      return NextResponse.json({ error: 'Submódulo não encontrado.' }, { status: 404 })
    }

    if (actions.length === 0) {
      await prisma.featureGrant.deleteMany({
        where: {
          groupId,
          featureId: feature.id,
        },
      })

      return NextResponse.json({ deleted: true })
    }

    const grant = await prisma.featureGrant.upsert({
      where: { groupId_featureId: { groupId, featureId: feature.id } },
      update: { actions },
      create: { groupId, featureId: feature.id, actions },
      select: { id: true, groupId: true, featureId: true, actions: true },
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