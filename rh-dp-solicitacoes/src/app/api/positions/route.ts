import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/positions  -> lista cargos
export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        workplace: true,
        workSchedule: true,
      },
    })

    return NextResponse.json(positions)
  } catch (e: any) {
    console.error('GET /api/positions error', e)
    return NextResponse.json(
      { error: 'Erro ao listar cargos.' },
      { status: 500 },
    )
  }
}

// POST /api/positions  -> cria cargo (usado pelo "Novo cargo")
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const position = await prisma.position.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        sectorProject: body.sectorProject ?? null,
        workplace: body.workplace ?? null,
        workSchedule: body.workSchedule ?? null,
        mainActivities: body.mainActivities ?? null,
        complementaryActivities: body.complementaryActivities ?? null,
        schooling: body.schooling ?? null,
        course: body.course ?? null,
        schoolingCompleted: body.schoolingCompleted ?? null,
        courseInProgress: body.courseInProgress ?? null,
        periodModule: body.periodModule ?? null,
        requiredKnowledge: body.requiredKnowledge ?? null,
        behavioralCompetencies: body.behavioralCompetencies ?? null,
        enxoval: body.enxoval ?? null,
        uniform: body.uniform ?? null,
        others: body.others ?? null,
        workPoint: body.workPoint ?? null,
        site: body.site ?? null,
      },
    })

    return NextResponse.json(position, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/positions error', e)
    return NextResponse.json(
      { error: 'Erro ao criar cargo.' },
      { status: 500 },
    )
  }
}
