// src/app/api/permissoes/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'
import { ensureUserDepartmentLink } from '@/lib/userDepartments'

export const dynamic = 'force-dynamic'

/**
 * GET /api/permissoes/usuarios?email=...
 *
 * Resposta:
 * {
 *   user: { id, fullName, email, departmentId } | null,
 *   modules: [{ id, key, name }],
 *   access: [{ moduleId, level }],
 *   departments: [{ id, code, name }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const { searchParams } = new URL(req.url)
    const searchTerm = searchParams.get('search') ?? searchParams.get('email')
    const normalizedTerm = searchTerm?.trim()

    if (!normalizedTerm) {
      return NextResponse.json(
        { error: 'Informe o nome ou e-mail do usuário.' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedTerm, mode: 'insensitive' } },
          { fullName: { contains: normalizedTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        departmentId: true,
      },
    })

    const [modules, departments, access] = await Promise.all([
      prisma.module.findMany({
        select: { id: true, key: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.department.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      user
        ? prisma.userModuleAccess.findMany({
            where: { userId: user.id },
            select: { moduleId: true, level: true },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      user,
      modules,
      departments,
      access,
    })
  } catch (e: any) {
    console.error('GET /api/permissoes/usuarios error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Erro ao carregar permissões do usuário.' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/permissoes/usuarios
 *
 * body:
 * - Para atualizar nível:
 *   { email, moduleId, level: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | null }
 *
 * - Para atualizar departamento:
 *   { email, departmentId: string | null }
 */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const body = await req.json().catch(() => ({} as any))
    const {
      email,
      moduleId,
      level,
      departmentId,
    }: {
      email?: string
      moduleId?: string
      level?: ModuleLevel | null
      departmentId?: string | null
    } = body

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

    // 1) Atualizar departamento do usuário
    if (typeof departmentId !== 'undefined') {
       const updated = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            departmentId: departmentId || null,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            departmentId: true,
          },
        })

        if (departmentId) {
          await ensureUserDepartmentLink(user.id, departmentId, tx)
        }

        return updatedUser
      })

      return NextResponse.json(updated)
    }

    // 2) Atualizar nível de módulo
    if (!moduleId) {
      return NextResponse.json(
        { error: 'moduleId é obrigatório quando level é informado.' },
        { status: 400 },
      )
    }

    const validLevels: ModuleLevel[] = [
      ModuleLevel.NIVEL_1,
      ModuleLevel.NIVEL_2,
      ModuleLevel.NIVEL_3,
    ]

    const normalizedLevel =
      level && (validLevels as string[]).includes(level)
        ? (level as ModuleLevel)
        : null

    const existing = await prisma.userModuleAccess.findFirst({
      where: {
        userId: user.id,
        moduleId,
      },
    })

    if (!normalizedLevel) {
      // remover acesso
      if (existing) {
        await prisma.userModuleAccess.delete({
          where: { id: existing.id },
        })
      }

      return NextResponse.json({ ok: true })
    }

    // criar ou atualizar
    if (existing) {
      await prisma.userModuleAccess.update({
        where: { id: existing.id },
        data: { level: normalizedLevel },
      })
    } else {
      await prisma.userModuleAccess.create({
        data: {
          userId: user.id,
          moduleId,
          level: normalizedLevel,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('PATCH /api/permissoes/usuarios error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar permissões do usuário.' },
      { status: 500 },
    )
  }
}
