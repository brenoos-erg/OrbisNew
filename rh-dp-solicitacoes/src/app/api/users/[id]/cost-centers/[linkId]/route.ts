export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/users/:id/cost-centers/:linkId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { linkId } = await params
  if (!linkId) {
    return NextResponse.json({ error: 'linkId é obrigatório.' }, { status: 400 })
  }

  try {
    await prisma.userCostCenter.delete({ where: { id: linkId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Se o registro não existir, Prisma lança not found -> 404
    console.error('DELETE user cost-center link error', e)
    return NextResponse.json(
      { error: 'Vínculo não encontrado.' },
      { status: 404 }
    )
  }
}