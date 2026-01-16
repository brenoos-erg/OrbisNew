export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

// PATCH /api/positions/[id] -> editar cargo
export async function PATCH(request: Request, { params }: Params) {
  try {
    const body = await request.json()

    const updated = await prisma.position.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description ?? null,
        departmentId: body.departmentId ?? null,

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
        experience: body.experience ?? null,
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('PATCH /api/positions/[id] error', e)
    return NextResponse.json(
      { error: 'Erro ao atualizar cargo' },
      { status: 500 },
    )
  }
}

// DELETE /api/positions/[id]
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await prisma.position.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/positions/[id] error', e)
    return NextResponse.json(
      { error: 'Erro ao excluir cargo' },
      { status: 500 },
    )
  }
}
