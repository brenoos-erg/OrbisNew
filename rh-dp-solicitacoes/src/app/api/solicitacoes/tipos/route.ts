import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tipos = await prisma.tipoSolicitacao.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json(tipos.map((tipo) => ({ id: tipo.id, name: tipo.nome })))
}