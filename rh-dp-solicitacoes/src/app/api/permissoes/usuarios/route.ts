export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { Action } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { normalizeModules } from '@/lib/normalizeModules'
import { ensureUserDepartmentLink } from '@/lib/userDepartments'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { withRequestMetrics } from '@/lib/request-metrics'
/**
 * Helper para montar o payload que o frontend espera
 */
async function buildUserPayload(search: string) {
  const searchTerm = search.trim()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: searchTerm, mode: 'insensitive' } },
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    orderBy: { fullName: 'asc' },
  })

  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' },
  })
  const normalizedModules = normalizeModules(modules)

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  })

   let access: { moduleId: string; level: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' }[] = []

  if (user) {
    const { levels } = await getUserModuleContext(user.id)
    const moduleByKey = normalizedModules.keyToId

    access = Object.entries(levels).flatMap(([key, level]) => {
      const moduleId = moduleByKey.get(key.toLowerCase())
      if (!moduleId) return []
      return [{ moduleId, level }]
    })
  }

  return {
    user: user
      ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          departmentId: user.departmentId,
        }
      : null,
      modules: normalizedModules.modules.map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
    })),
    access,
    departments: departments.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
    })),
  }
}

// GET /api/permissoes/usuarios?email=...
export async function GET(req: NextRequest) {
  return withRequestMetrics('GET /api/permissoes/usuarios', async () => {
    try {
      const me = await requireActiveUser()
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, 'NIVEL_3')
      await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)

      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') ?? searchParams.get('email')

      if (!search) {
        return NextResponse.json(
          { error: 'Informe o nome ou e-mail do usuário.' },
          { status: 400 },
        )
      }

    const payload = await buildUserPayload(search)
      return NextResponse.json(payload)
    } catch (e: any) {
      console.error('GET /api/permissoes/usuarios error', e)
      return NextResponse.json(
        { error: e?.message || 'Erro ao carregar permissões do usuário.' },
        { status: 500 },
      )
    }
  })
}

// PATCH /api/permissoes/usuarios
export async function PATCH(req: NextRequest) {
  return withRequestMetrics('PATCH /api/permissoes/usuarios', async () => {
    try {
      const me = await requireActiveUser()
      await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, 'NIVEL_3')
      await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

      const body = await req.json().catch(() => ({}))

      const email = body.email as string | undefined
      const moduleId = body.moduleId as string | undefined
      const level = body.level as 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | '' | null
      const departmentId = body.departmentId as string | null | undefined

      if (!email) {
        return NextResponse.json(
          { error: 'Campo "email" é obrigatório.' },
          { status: 400 },
        )
      }
    const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return NextResponse.json(
          { error: 'Usuário não encontrado.' },
          { status: 404 },
        )
      }

      // 1) Atualizar departamento, se veio no payload
      if (departmentId !== undefined) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: {
              departmentId: departmentId || null,
            },
          })

    if (departmentId) {
            await ensureUserDepartmentLink(user.id, departmentId, tx)
          }
        })
      }
        // 2) Atualizar acesso de módulo, se veio moduleId
      if (moduleId) {
        if (!level) {
          // remover acesso
          await prisma.userModuleAccess.deleteMany({
            where: {
              userId: user.id,
              moduleId,
            },
          })
        } else {
          // upsert no nível do módulo
          await prisma.userModuleAccess.upsert({
            where: {
              userId_moduleId: {
                userId: user.id,
                moduleId,
              },
            },
            create: {
              userId: user.id,
              moduleId,
              level,
            },
            update: {
              level,
            },
          })
        }
      }
    const payload = await buildUserPayload(email)
      return NextResponse.json(payload)
    } catch (e: any) {
      console.error('PATCH /api/permissoes/usuarios error', e)
      return NextResponse.json(
        { error: e?.message || 'Erro ao atualizar permissões do usuário.' },
        { status: 500 },
      )
    }
  })
}
