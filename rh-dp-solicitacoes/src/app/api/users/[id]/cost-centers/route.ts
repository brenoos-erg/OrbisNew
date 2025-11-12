// src/app/api/users/[id]/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Status = 'ATIVO' | 'INATIVO'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()

  // validação simples (use Zod se quiser)
  const dataToUpdate: any = {}
  if (typeof body.fullName === 'string') dataToUpdate.fullName = body.fullName
  if (typeof body.login === 'string') dataToUpdate.login = body.login
  if (typeof body.phone === 'string') dataToUpdate.phone = body.phone
  if (body.status === 'ATIVO' || body.status === 'INATIVO') {
    dataToUpdate.status = body.status as Status         // ⬅️ salvar status
  }

  // senha opcional (se existir no seu fluxo)
  if (typeof body.password === 'string' && body.password.length > 0) {
    // … sua lógica de troca de senha, se houver
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: dataToUpdate,
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      status: true,            // ⬅️ devolva status
      costCenterId: true,
    },
  })

  return NextResponse.json(updated)
}
