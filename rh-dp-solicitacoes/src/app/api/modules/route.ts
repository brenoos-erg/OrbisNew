import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const mods = await prisma.module.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, key: true, name: true },
  })
  return NextResponse.json(mods)
}
