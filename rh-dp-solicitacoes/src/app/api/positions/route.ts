export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRequestMetrics } from "@/lib/request-metrics"


// GET /api/positions?pageSize=200
export async function GET(req: Request) {
  return withRequestMetrics('GET /api/positions', async () => {
    try {
      const url = new URL(req.url)
      const _pageSize =
        parseInt(url.searchParams.get("pageSize") ?? "200") || 200
      void _pageSize

    const positions = await prisma.position.findMany({
        select: {
          id: true,
          name: true,
          sectorProject: true,
          workplace: true,
          workSchedule: true,
          mainActivities: true,
          schooling: true,
          course: true,
          experience: true,
          requiredKnowledge: true,
          behavioralCompetencies: true,
          // ...outros que você quiser
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(
        {
          items: positions, // formata igual /api/cost-centers
          total: positions.length,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
          },
        },
      )
    } catch (error) {
      console.error('Erro em GET /api/positions:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar cargos' },
             { status: 500 }
      )
    }
  })
}