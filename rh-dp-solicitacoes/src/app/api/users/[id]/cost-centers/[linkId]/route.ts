// src/app/api/users/[id]/cost-centers/[linkId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/users/:id/cost-centers/:linkId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params

  // opcional: garantir que o link pertence ao usuário
  const link = await prisma.userCostCenter.findFirst({
    where: { id: linkId, userId: id },
    select: { id: true },
  })
  if (!link) {
    return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 })
  }

  await prisma.userCostCenter.delete({
    where: { id: linkId },
  })

  return NextResponse.json({ ok: true })
}
