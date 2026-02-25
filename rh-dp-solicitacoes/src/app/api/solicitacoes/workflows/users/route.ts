export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser()

    const search = req.nextUrl.searchParams.get('search')?.trim() ?? ''

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {},
      select: {
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