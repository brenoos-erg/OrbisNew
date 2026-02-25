export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser()

    const search = req.nextUrl.searchParams.get('search')?.trim() ?? ''

    const departmentId = req.nextUrl.searchParams.get('departmentId')?.trim() ?? ''

    const users = await prisma.user.findMany({
      where: {
        AND: [
          ...(search
            ? [
                {
                  OR: [
                    { fullName: { contains: search } },
                    { email: { contains: search } },
                  ],
                },
              ]
            : []),
          {
            moduleAccesses: {
              some: { module: { key: 'solicitacoes' }, level: ModuleLevel.NIVEL_3 },
            },
          },
          ...(departmentId
            ? [
                {
                  OR: [
                    { departmentId },
                    { userDepartments: { some: { departmentId } } },
                  ],
                },
              ]
            : []),
        ],
      },      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('GET /api/solicitacoes/workflows/users error', error)
    return NextResponse.json({ error: 'Erro ao buscar usuários.' }, { status: 500 })
  }
}