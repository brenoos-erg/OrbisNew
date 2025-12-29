import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { prisma } from '@/lib/prisma';
import { ensureUserDepartmentLink } from '@/lib/userDepartments';

// GET /api/me
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    );
  }

  const email = user.email;
  const authId = user.id; // UUID do Supabase

  if (!email) {
    return NextResponse.json(
      { error: 'Usuário do Supabase sem e-mail.' },
      { status: 400 }
    );
  }

  // Busca usuário por authId OU email e já traz as relações
  let dbUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId }, { email }],
    },
    include: {
      position: true,
      department: true,
      costCenter: true,
      leader: true,
    },
  });

  // Se não existir ainda na base, cria um registro básico
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email,
        fullName:
          (user.user_metadata as any)?.full_name ??
          (user.user_metadata as any)?.name ??
          email,
        login:
          (user.user_metadata as any)?.login ??
          email,
        authId,
      },
      include: {
        position: true,
        department: true,
        costCenter: true,
        leader: true,
      },
    });
  }

  // ATENÇÃO AOS CAMPOS: bati com o seu schema.prisma
  const responseBody = {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    login: dbUser.login,
    phone: dbUser.phone,

    // Cargo → Position.name
    positionId: dbUser.positionId,
    positionName: dbUser.position?.name ?? null,

    // Setor/Departamento → Department.name
    departmentId: dbUser.departmentId,
    departmentName: dbUser.department?.name ?? null,

    // Centro de Custo → CostCenter.description (pode exibir code + description)
    costCenterId: dbUser.costCenterId,
    costCenterName: dbUser.costCenter
      ? `${dbUser.costCenter.code ? dbUser.costCenter.code + ' - ' : ''}${
          dbUser.costCenter.description
        }`
      : null,

    // Líder → Leader.fullName
    leaderId: dbUser.leaderId,
    leaderName: dbUser.leader?.fullName ?? null,
  };

  return NextResponse.json(responseBody);
}

// PATCH /api/me (para tela de perfil, se você quiser manter)
export async function PATCH(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    );
  }

  const email = user.email;
  const authId = user.id;

  if (!email) {
    return NextResponse.json(
      { error: 'Usuário do Supabase sem e-mail.' },
      { status: 400 }
    );
  }

  const body = await req.json();

  const updated = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      authId,
      fullName: body.fullName ?? '',
      login: body.login ?? email,
      phone: body.phone ?? null,
      positionId: body.positionId ?? null,
      departmentId: body.departmentId ?? null,
      costCenterId: body.costCenterId ?? null,
      leaderId: body.leaderId ?? null,
    },
    update: {
      fullName: body.fullName ?? undefined,
      login: body.login ?? undefined,
      phone: body.phone ?? undefined,
      positionId: body.positionId ?? undefined,
      departmentId: body.departmentId ?? undefined,
      costCenterId: body.costCenterId ?? undefined,
      leaderId: body.leaderId ?? undefined,
    },
  });

  if (body.departmentId) {
    await ensureUserDepartmentLink(updated.id, body.departmentId);
  }


  return NextResponse.json(updated);
}
