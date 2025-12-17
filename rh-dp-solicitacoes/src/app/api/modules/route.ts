import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRequestMetrics } from '@/lib/request-metrics'

export const revalidate = 300

export async function GET() {
  return withRequestMetrics('GET /api/modules', async () => {
    const mods = await prisma.module.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true },
    })
    return NextResponse.json(mods)
  })
}