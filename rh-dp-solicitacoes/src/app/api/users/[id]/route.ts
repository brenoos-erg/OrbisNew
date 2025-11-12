// src/app/api/users/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id },       // ID da tabela User (Prisma)
        { authId: id } // UUID do Supabase Auth (se você passar o authId por engano)
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      status: true,
      costCenterId: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json(user)
}
