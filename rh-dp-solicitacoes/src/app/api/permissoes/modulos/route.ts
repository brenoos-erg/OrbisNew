import { NextRequest, NextResponse } from 'next/server'

import { Action, ModuleLevel, UserStatus } from '@prisma/client'

import { assertUserMinLevel } from '@/lib/access'
import { requireActiveUser } from '@/lib/auth'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

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

    const [module, department] = await Promise.all([
      prisma.module.findUnique({
        where: { id: moduleId },
        select: { id: true, key: true, name: true },
      }),
      departmentId
        ? prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve(null),
    ])

    if (!module) {
      return NextResponse.json(
        { error: 'Módulo não encontrado.' },
        { status: 404 },
      )
    }
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
            where: { moduleId },
            select: { level: true },
          },
        },
        orderBy: { fullName: 'asc' },
      })

      return NextResponse.json({
        module,
        department,
        users: users.map((user) => ({
          level: user.moduleAccesses[0]?.level ?? null,
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
      where: { moduleId, user: { status: UserStatus.ATIVO } },
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

    return NextResponse.json({
      module,
      department: null,
      users: accesses.map((access) => ({
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
      })),
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