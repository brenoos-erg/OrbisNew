import { NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withModuleLevel } from '@/lib/access'

export const GET = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_1,
  async (req: Request) => {
    const url = new URL(req.url)
    const search = url.searchParams.get('search')?.trim() || ''

    if (!search) {
      return NextResponse.json([])
    }

    const items = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { login: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        costCenter: {
          select: {
            id: true,
            description: true,
            externalCode: true,
            code: true,
          },
        },
      },
    })

    return NextResponse.json(
      items.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        costCenter: user.costCenter,
      })),
    )
  },
)