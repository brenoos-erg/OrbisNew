// src/app/api/configuracoes/permissoes/usuarios/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, key: true, name: true },
  })

  const rows = await prisma.user.findMany({
    orderBy: { fullName: 'asc' },
    take: 200,
    select: {
      id: true,
      fullName: true,
      email: true,
      department: { select: { name: true } },
      moduleAccesses: {
        include: {
          module: { select: { key: true } },
        },
      },
    },
  })

  const users = rows.map((u) => {
    const levels: Record<string, string | null> = {}
    for (const access of u.moduleAccesses) {
      levels[access.module.key] = access.level
    }

    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      departmentName: u.department?.name ?? null,
      levels,
    }
  })

  return NextResponse.json({ modules, users })
}
