import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


// Lista todos os tipos de solicitação (para popular o select do formulário)
export async function GET() {
const tipos = await prisma.tipoSolicitacao.findMany({ orderBy: { nome: 'asc' } })
return NextResponse.json(tipos)
}


// Cria um novo tipo de solicitação (admin)
export async function POST(req: NextRequest) {
const body = await req.json() // lê o JSON enviado no corpo
const { nome, descricao, schemaJson } = body // extrai campos esperados
if (!nome || !schemaJson) { // validação mínima
return NextResponse.json({ error: 'nome e schemaJson são obrigatórios' }, { status: 400 })
}
const tipo = await prisma.tipoSolicitacao.create({ // grava no banco
data: { nome, descricao, schemaJson }
})
return NextResponse.json(tipo, { status: 201 }) // retorna criado
}