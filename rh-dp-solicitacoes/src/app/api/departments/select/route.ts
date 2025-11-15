import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function GET() {
  try {
    const data = await prisma.department.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })

    const formatted = data.map((d) => ({
      id: d.id,
      label: d.name,
      description: d.code,
    }))

    return NextResponse.json(formatted)
  } catch (e) {
    console.error('Erro ao listar departamentos:', e)
    return NextResponse.json({ error: 'Erro ao buscar departamentos' }, { status: 500 })
  }
}
