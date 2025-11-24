import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await prisma.position.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.log(e)
    return NextResponse.json({ error: 'Erro ao carregar cargos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const r = await prisma.position.create({ data })
    return NextResponse.json(r)
  } catch (e) {
    console.log(e)
    return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 })
  }
}
