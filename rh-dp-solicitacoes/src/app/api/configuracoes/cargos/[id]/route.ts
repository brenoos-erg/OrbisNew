export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteParams = {
  params: { id: string };
};

// GET /api/configuracoes/cargos/:id
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const cargo = await prisma.position.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        description: true,
        sectorProject: true,
        workplace: true,
        workSchedule: true,
        mainActivities: true,
        schooling: true,
        experience: true,
        requiredKnowledge: true,
        behavioralCompetencies: true,
        site: true,
        workPoint: true,
        departmentId: true,
      },
    });

    if (!cargo) {
      return NextResponse.json(
        { error: 'Cargo não encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json(cargo);
  } catch (err) {
    console.error('Erro GET /api/configuracoes/cargos/[id]:', err);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 },
    );
  }
}

// PATCH /api/configuracoes/cargos/:id
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const body = await req.json();

    const updated = await prisma.position.update({
      where: { id: params.id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        sectorProject: body.sectorProject ?? undefined,
        workplace: body.workplace ?? undefined,
        workSchedule: body.workSchedule ?? undefined,
        mainActivities: body.mainActivities ?? undefined,
        schooling: body.schooling ?? undefined,
        experience: body.experience ?? undefined,
        requiredKnowledge: body.requiredKnowledge ?? undefined,
        behavioralCompetencies: body.behavioralCompetencies ?? undefined,
        site: body.site ?? undefined,
        workPoint: body.workPoint ?? undefined,
        departmentId: body.departmentId ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Erro PATCH /api/configuracoes/cargos/[id]:', err);
    return NextResponse.json(
      { error: 'Erro ao atualizar cargo' },
      { status: 500 },
    );
  }
}

// DELETE /api/configuracoes/cargos/:id
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    await prisma.position.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro DELETE /api/configuracoes/cargos/[id]:', err);
    return NextResponse.json(
      { error: 'Erro ao excluir cargo' },
      { status: 500 },
    );
  }
}
