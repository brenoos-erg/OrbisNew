import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/users/:id/cost-centers/:ccId
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; ccId: string } }
) {
  const { id: userId, ccId: costCenterId } = params

  try {
    await prisma.userCostCenter.delete({
      where: { userId_costCenterId: { userId, costCenterId } }, // precisa da @@unique
    })

    // pode ser 204 sem body; aqui retorno ok:true pra facilitar debug
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: any) {
    // Se não existir, delete lança; trate como 404 para UX melhor
    return NextResponse.json(
      { error: 'Vínculo não encontrado', detail: err?.message },
      { status: 404 },
    )
  }
}
