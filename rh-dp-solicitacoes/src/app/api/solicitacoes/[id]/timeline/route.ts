export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const solicitationId = (await params).id

    const timelines = await prisma.solicitationTimeline.findMany({
      where: { solicitationId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      timelines.map((item) => ({
        id: item.id,
        status: item.status,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        actor: null,
      })),
    )
  } catch (error) {
    console.error('Erro em GET /api/solicitacoes/[id]/timeline', error)
    return NextResponse.json({ error: 'Erro ao buscar timeline' }, { status: 500 })
  }
}