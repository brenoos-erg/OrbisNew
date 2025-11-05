import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


// Criação de solicitação
export async function POST(req: NextRequest) {
const body = await req.json() // lê o body JSON
const { titulo, descricao, setorDestino, tipoId, autorId, payload } = body


// checagens básicas de obrigatórios
if (!titulo || !descricao || !setorDestino || !tipoId || !autorId) {
return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
}


// cria a solicitação no banco
const nova = await prisma.solicitation.create({
data: {
titulo,
descricao,
setorDestino, // deve ser 'RH' ou 'DP'
tipoId,
autorId,
payload: payload ?? {}
}
})


// registra evento de auditoria
await prisma.event.create({
data: {
solicitationId: nova.id,
actorId: autorId,
tipo: 'create',
dados: { titulo }
}
})


return NextResponse.json(nova, { status: 201 })
}


// Listagem com filtros simples (?status=&tipoId=&setor=)
export async function GET(req: NextRequest) {
const { searchParams } = new URL(req.url)
const status = searchParams.get('status') || undefined
const tipoId = searchParams.get('tipoId') || undefined
const setor = searchParams.get('setor') || undefined


const itens = await prisma.solicitation.findMany({
where: {
status: status as any,
tipoId,
setorDestino: setor as any
},
orderBy: { createdAt: 'desc' },
include: { tipo: true }
})
return NextResponse.json(itens)
}