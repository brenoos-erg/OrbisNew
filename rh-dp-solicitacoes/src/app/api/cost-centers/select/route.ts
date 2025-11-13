import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  let where: Prisma.CostCenterWhereInput | undefined = undefined

  if (q) {
    where = {
      OR: [
        { description: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { abbreviation: { contains: q, mode: 'insensitive' } },
      ]
    }
  }

  const rows = await prisma.costCenter.findMany({
    where,
    orderBy: { description: 'asc' },
    select: {
      id: true,
      description: true,
      code: true,
      externalCode: true,
    },
  })

  return NextResponse.json(rows)
}
