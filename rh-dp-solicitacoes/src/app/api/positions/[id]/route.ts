import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// PATCH /api/positions/:id  -> editar cargo
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json()
    const { id } = params

    const position = await prisma.position.update({
      where: { id },
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

    return NextResponse.json(position)
  } catch (e: any) {
    console.error('PATCH /api/positions/[id] error', e)
    return NextResponse.json(
      { error: 'Erro ao atualizar cargo.' },
      { status: 500 },
    )
  }
}

// DELETE /api/positions/:id  -> remover cargo
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = params
    await prisma.position.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/positions/[id] error', e)
    return NextResponse.json(
      { error: 'Erro ao excluir cargo.' },
      { status: 500 },
    )
  }
}
