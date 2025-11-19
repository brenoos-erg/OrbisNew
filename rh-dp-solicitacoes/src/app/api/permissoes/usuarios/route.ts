import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'

/**
 * Helper para montar o payload que o frontend espera
 */
async function buildUserPayload(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' },
  })

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  })

  let access: { moduleId: string; level: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' }[] =
    []

  if (user) {
    const rows = await prisma.userModuleAccess.findMany({
      where: { userId: user.id },
    })

    access = rows.map((r) => ({
      moduleId: r.moduleId,
      level: r.level,
    }))
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
    modules: modules.map((m) => ({
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
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', 'NIVEL_3')

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Parâmetro "email" é obrigatório.' },
        { status: 400 },
      )
    }

    const payload = await buildUserPayload(email)
    return NextResponse.json(payload)
  } catch (e: any) {
    console.error('GET /api/permissoes/usuarios error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao carregar permissões do usuário.' },
      { status: 500 },
    )
  }
}

// PATCH /api/permissoes/usuarios
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', 'NIVEL_3')

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
      await prisma.user.update({
        where: { id: user.id },
        data: {
          departmentId: departmentId || null,
        },
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
}
