export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

import { Action, ModuleLevel } from '@prisma/client'

import { assertUserMinLevel } from '@/lib/access'
import { requireActiveUser } from '@/lib/auth'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ensureUserDepartmentLink, removeUserDepartmentLink } from '@/lib/userDepartments'


type UserSummary = {
  id: string
  fullName: string
  email: string
  departmentId: string | null
  departments: string[]
}

function mapUserWithMembership(user: UserSummary, departmentId?: string | null) {
  const isMember =
    !!departmentId &&
    (user.departmentId === departmentId || user.departments.includes(departmentId))
  const isPrimary = !!departmentId && user.departmentId === departmentId

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    departmentId: user.departmentId,
    isMember,
    isPrimary,
    canRemove: isMember && !isPrimary,
    departments: user.departments,
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')?.trim()

    if (!departmentId && !search) {
      return NextResponse.json(
        { error: 'Informe departmentId ou um termo de busca.' },
        { status: 400 },
      )
    }

    if (search) {
      const users = await prisma.user.findMany({
        where: {
          fullName: { contains: search, mode: 'insensitive' },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          departmentId: true,
          userDepartments: { select: { departmentId: true } },
        },
        orderBy: { fullName: 'asc' },
        take: 20,
      })

      return NextResponse.json(
        users.map((u) =>
          mapUserWithMembership(
            {
              id: u.id,
              fullName: u.fullName,
              email: u.email,
              departmentId: u.departmentId,
              departments: u.userDepartments.map((d) => d.departmentId),
            },
            departmentId,
          ),
        ),
      )
    }

    // Listagem dos membros do departamento
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { departmentId: departmentId! },
          { userDepartments: { some: { departmentId: departmentId! } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        departmentId: true,
        userDepartments: { select: { departmentId: true } },
      },
      orderBy: { fullName: 'asc' },
    })

    return NextResponse.json(
      users.map((u) =>
        mapUserWithMembership(
          {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            departmentId: u.departmentId,
            departments: u.userDepartments.map((d) => d.departmentId),
          },
          departmentId,
        ),
      ),
    )
  } catch (e: any) {
    console.error('GET /api/permissoes/departamentos/usuarios error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: e?.message || 'Erro ao carregar usuários do departamento.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

    const body = await req.json().catch(() => ({}))
    const departmentId = body.departmentId as string | undefined
    const userId = body.userId as string | undefined
    const setAsPrimary = Boolean(body.setAsPrimary)

    if (!departmentId || !userId) {
      return NextResponse.json(
        { error: 'departmentId e userId são obrigatórios.' },
        { status: 400 },
      )
    }

    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ])

    if (!department) {
      return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await ensureUserDepartmentLink(userId, departmentId, tx)

      if (setAsPrimary) {
        await tx.user.update({
          where: { id: userId },
          data: { departmentId },
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/permissoes/departamentos/usuarios error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: e?.message || 'Erro ao adicionar usuário ao departamento.' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.UPDATE)

    const url = new URL(req.url)
    const departmentId = url.searchParams.get('departmentId')
    const userId = url.searchParams.get('userId')

    if (!departmentId || !userId) {
      return NextResponse.json(
        { error: 'departmentId e userId são obrigatórios.' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    if (user.departmentId === departmentId) {
      return NextResponse.json(
        { error: 'Esse é o departamento principal do usuário. Altere o principal antes de remover.' },
        { status: 400 },
      )
    }

    await removeUserDepartmentLink(userId, departmentId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/permissoes/departamentos/usuarios error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: e?.message || 'Erro ao remover usuário do departamento.' },
      { status: 500 },
    )
  }
}