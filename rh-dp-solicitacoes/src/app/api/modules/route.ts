import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeModules } from '@/lib/normalizeModules'
import { withRequestMetrics } from '@/lib/request-metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  return withRequestMetrics('GET /api/modules', async () => {
    const mods = await prisma.module.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true },
    })

    const normalized = normalizeModules(mods)

    return NextResponse.json(normalized.modules)
  })
}