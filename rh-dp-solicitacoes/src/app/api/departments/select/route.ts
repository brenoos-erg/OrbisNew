// src/app/api/departments/select/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })

  const list = rows.map((d: (typeof rows)[number]) => ({
    id: d.id,
    label: d.name,
    description: d.description ?? null,
  }))

  return NextResponse.json(list)
}
