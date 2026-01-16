export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cargos = await prisma.position.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sectorProject: true,
      },
    });

    return NextResponse.json(cargos);
  } catch (err) {
    console.error('Erro GET /api/configuracoes/cargos:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cargo = await prisma.position.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        sectorProject: body.sectorProject ?? null,
        workplace: body.workplace ?? null,
        workSchedule: body.workSchedule ?? null,
        mainActivities: body.mainActivities ?? null,
        schooling: body.schooling ?? null,
        experience: body.experience ?? null,
        requiredKnowledge: body.requiredKnowledge ?? null,
        behavioralCompetencies: body.behavioralCompetencies ?? null,
        site: body.site ?? null,
        workPoint: body.workPoint ?? null,
        departmentId: body.departmentId ?? null,
      },
    });

    return NextResponse.json(cargo);
  } catch (err) {
    console.error('Erro POST /api/configuracoes/cargos:', err);
    return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 });
  }
}
