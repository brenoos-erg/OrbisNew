
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// GET /api/positions?pageSize=200
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const pageSize =
      parseInt(url.searchParams.get("pageSize") ?? "200") || 200

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

    return NextResponse.json({
      items: positions, // formata igual /api/cost-centers
      total: positions.length,
     })
  } catch (error) {
    console.error('Erro em GET /api/positions:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar cargos' },
      { status: 500 }
    )
  }
}