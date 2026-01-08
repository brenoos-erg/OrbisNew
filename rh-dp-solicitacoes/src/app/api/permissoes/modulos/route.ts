import { NextRequest, NextResponse } from 'next/server'

import { Action, ModuleLevel, UserStatus } from '@prisma/client'

import { assertUserMinLevel } from '@/lib/access'
import { requireActiveUser } from '@/lib/auth'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeModules } from '@/lib/normalizeModules'

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)
    

    const { searchParams } = new URL(req.url)
    const moduleId = searchParams.get('moduleId')
      const departmentId = searchParams.get('departmentId')

    if (!moduleId) {
      return NextResponse.json(
        { error: 'Parâmetro "moduleId" é obrigatório.' },
        { status: 400 },
      )
    }

    const [modules, department] = await Promise.all([
      prisma.module.findMany({
        select: { id: true, key: true, name: true },
      }),
      departmentId
        ? prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve(null),
    ])

    const moduleRecord = modules.find((entry) => entry.id === moduleId)

    if (!moduleRecord) {
      return NextResponse.json(
        { error: 'Módulo não encontrado.' },
        { status: 404 },
      )
      
    }
    const normalizedModules = normalizeModules(modules)
    const canonicalId = normalizedModules.idToCanonicalId.get(moduleId) ?? moduleId
    const module =
      normalizedModules.modules.find((entry) => entry.id === canonicalId) ?? moduleRecord
    const relatedModuleIds = modules
      .filter((entry) => normalizedModules.idToCanonicalId.get(entry.id) === canonicalId)
      .map((entry) => entry.id)
    if (departmentId && !department) {
      return NextResponse.json(
        { error: 'Departamento não encontrado.' },
        { status: 404 },
      )
    }

    if (department) {
      const users = await prisma.user.findMany({
        where: { departmentId, status: UserStatus.ATIVO },
        select: {
          id: true,
          fullName: true,
          email: true,
          department: { select: { id: true, code: true, name: true } },
          moduleAccesses: {
            where: { moduleId: { in: relatedModuleIds } },
            select: { level: true },
          },
        },
        orderBy: { fullName: 'asc' },
      })

      return NextResponse.json({
        module,
        department,
        users: users.map((user) => ({
           level:
            user.moduleAccesses.length === 0
              ? null
              : user.moduleAccesses.reduce((acc, access) => {
                  if (!acc) return access.level
                  if (access.level === ModuleLevel.NIVEL_3) return access.level
                  if (access.level === ModuleLevel.NIVEL_2 && acc !== ModuleLevel.NIVEL_3) {
                    return access.level
                  }
                  return acc
                }, user.moduleAccesses[0]?.level ?? null),
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            department: user.department
              ? {
                  id: user.department.id,
                  code: user.department.code,
                  name: user.department.name,
                }
              : null,
          },
        })),
      })
    }

     const accesses = await prisma.userModuleAccess.findMany({
      where: { moduleId: { in: relatedModuleIds }, user: { status: UserStatus.ATIVO } },
      select: {
        level: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    })
    const merged = new Map<
      string,
      {
        level: ModuleLevel
        user: {
          id: string
          fullName: string
          email: string
          department: { id: string; code: string; name: string } | null
        }
      }
    >()

    accesses.forEach((access) => {
      const existing = merged.get(access.user.id)
      if (!existing) {
        merged.set(access.user.id, {
          level: access.level,
          user: {
            id: access.user.id,
            fullName: access.user.fullName,
            email: access.user.email,
            department: access.user.department
              ? {
                  id: access.user.department.id,
                  code: access.user.department.code,
                  name: access.user.department.name,
                }
              : null,
          },
        })
        return
      }

      if (access.level === ModuleLevel.NIVEL_3) {
        existing.level = access.level
      } else if (access.level === ModuleLevel.NIVEL_2 && existing.level !== ModuleLevel.NIVEL_3) {
        existing.level = access.level
      }
    })

    const users = Array.from(merged.values()).sort((a, b) =>
      a.user.fullName.localeCompare(b.user.fullName),
    )


    return NextResponse.json({
      module,
      department: null,
      users,
    })
  } catch (e: any) {
    console.error('GET /api/permissoes/modulos error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: e?.message || 'Erro ao carregar usuários do módulo.' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

    const body = await req.json().catch(() => ({}))
    const moduleId = body.moduleId as string | undefined
    const userIds = body.userIds as string[] | undefined
    const rawLevel = body.level as ModuleLevel | null | undefined

    if (!moduleId) {
      return NextResponse.json({ error: 'Campo "moduleId" é obrigatório.' }, { status: 400 })
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos um usuário para atualizar.' }, { status: 400 })
    }
    const modules = await prisma.module.findMany({
      select: { id: true, key: true, name: true },
    })
    const moduleRecord = modules.find((entry) => entry.id === moduleId)
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Módulo não encontrado.' }, { status: 404 })
    }

    const normalizedModules = normalizeModules(modules)
    const canonicalId = normalizedModules.idToCanonicalId.get(moduleId) ?? moduleId
    const relatedModuleIds = modules
      .filter((entry) => normalizedModules.idToCanonicalId.get(entry.id) === canonicalId)
      .map((entry) => entry.id)
    const otherModuleIds = relatedModuleIds.filter((id) => id !== canonicalId)


    const validLevels: ModuleLevel[] = [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3]
    const level = rawLevel && validLevels.includes(rawLevel) ? rawLevel : null

    if (!level) {
      await prisma.userModuleAccess.deleteMany({
        where: {
          moduleId: { in: relatedModuleIds },
          userId: { in: userIds },
        },
      })
    } else {
      await prisma.$transaction(async (tx) => {
        if (otherModuleIds.length > 0) {
          await tx.userModuleAccess.deleteMany({
            where: {
              moduleId: { in: otherModuleIds },
              userId: { in: userIds },
            },
          })
        }

        await Promise.all(
          userIds.map((userId) =>
            tx.userModuleAccess.upsert({
              where: {
                userId_moduleId: {
                  userId,
                  moduleId: canonicalId,
                },
              },
              create: {
                userId,
                moduleId: canonicalId,
                level,
              },
              update: {
                level,
              },
            }),
          ),
        )
      })
    }

    return NextResponse.json({ ok: true, updated: userIds.length, level })
  } catch (e: any) {
    console.error('PATCH /api/permissoes/modulos error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: e?.message || 'Erro ao atualizar níveis do módulo.' },
      { status: 500 },
    )
  }
}
