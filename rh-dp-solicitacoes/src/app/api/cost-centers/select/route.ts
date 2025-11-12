import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  const where: Prisma.CostCenterWhereInput | undefined = q
    ? {
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { code: { contains: q } },
          { abbreviation: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined

  const rows = await prisma.costCenter.findMany({
    where,
    orderBy: { description: 'asc' },
    select: { id: true, description: true },
  })

  return NextResponse.json(rows)
}