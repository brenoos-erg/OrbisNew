import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function GET() {
  try {
    const data = await prisma.costCenter.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        description: true,
        externalCode: true,
      },
      orderBy: { description: 'asc' },
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('Erro ao listar cost centers:', e)
    return NextResponse.json({ error: 'Erro ao buscar centros de custo' }, { status: 500 })
  }
}
