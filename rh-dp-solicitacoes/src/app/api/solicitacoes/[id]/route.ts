import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


// Detalhe da solicitação (inclui relações úteis)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
const item = await prisma.solicitation.findUnique({
where: { id: params.id },
include: { tipo: true, comentarios: { include: { autor: true } }, anexos: true, eventos: true }
})
if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
return NextResponse.json(item)
}


// Atualizações parciais: status, responsável, payload
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
const body = await req.json()
const { status, responsavelId, payload, actorId } = body // actorId: quem está fazendo a ação


const item = await prisma.solicitation.update({
where: { id: params.id },
data: { status, responsavelId, payload }
})


// evento de auditoria
await prisma.event.create({
data: {
solicitationId: params.id,
actorId: actorId || responsavelId || item.autorId,
tipo: 'update',
dados: { status, responsavelId }
}
})


return NextResponse.json(item)
}