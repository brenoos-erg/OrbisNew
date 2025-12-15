import { NextRequest, NextResponse } from 'next/server'

import { ModuleLevel } from '@prisma/client'

import { assertUserMinLevel } from '@/lib/access'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const { searchParams } = new URL(req.url)
    const moduleId = searchParams.get('moduleId')

    if (!moduleId) {
      return NextResponse.json(
        { error: 'Parâmetro "moduleId" é obrigatório.' },
        { status: 400 },
      )
    }

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, key: true, name: true },
    })

    if (!module) {
      return NextResponse.json(
        { error: 'Módulo não encontrado.' },
        { status: 404 },
      )
    }

    const accesses = await prisma.userModuleAccess.findMany({
      where: { moduleId },
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