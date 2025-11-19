// src/app/api/positions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// PATCH: editar cargo
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json()
    const { id } = params

    const updated = await prisma.position.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        departmentId: body.departmentId ?? null,
        baseSalary: body.baseSalary ?? null,
        workLocation: body.workLocation ?? null,
        workHours: body.workHours ?? null,
        requirements: body.requirements ?? null,
        activities: body.activities ?? null,
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/positions/[id] error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao atualizar cargo.' },
      { status: 500 },
    )
  }
}

// DELETE: remover cargo
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = params
    await prisma.position.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/positions/[id] error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao excluir cargo.' },
      { status: 500 },
    )
  }
}
