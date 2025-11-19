// src/app/api/permissoes/usuarios/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth' // se você já usa isso em outras rotas

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { userId: string }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // opcional: só deixa logado mexer
    await requireActiveUser()

    const { userId } = params
    const body = await req.json().catch(() => ({}))

    const {
      departmentId, // string | null
      levels,       // [{ moduleId, level }]
    } = body as {
      departmentId?: string | null
      levels?: { moduleId: string; level: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' }[]
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Atualiza o departamento, se veio no body
      if (departmentId !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { departmentId: departmentId || null },
        })
      }

      // 2) Atualiza níveis de módulo, se veio no body
      if (Array.isArray(levels)) {
        for (const { moduleId, level } of levels) {
          await tx.userModuleAccess.upsert({
            where: {
              userId_moduleId: { userId, moduleId },
            },
            create: {
              userId,
              moduleId,
              level,
            },
            update: {
              level,
            },
          })
        }
      }

      // 3) Devolve o usuário atualizado com departamento + acessos
      return tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
          moduleAccesses: {
            select: {
              moduleId: true,
              level: true,
              module: { select: { id: true, key: true, name: true } },
            },
          },
        },
      })
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('PATCH /api/permissoes/usuarios/[userId] error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao atualizar permissões.' },
      { status: 500 },
    )
  }
}
