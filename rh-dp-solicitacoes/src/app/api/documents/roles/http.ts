import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export function documentRoleApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'Usuário não autenticado') return NextResponse.json({ error: error.message }, { status: 401 })
    if (error.message === 'Usuário inativo' || error.message === 'Acesso negado.') return NextResponse.json({ error: error.message }, { status: 403 })
    if (error.message.includes('não encontrada')) return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message.includes('duplicada') || error.message.includes('conflito')) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error.message.includes('obrigat') || error.message.includes('inválid') || error.message.includes('validUntil')) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ error: 'Atribuição duplicada para usuário, papel e escopo ativos.' }, { status: 409 })
  }
  console.error('[documents.roles] unexpected-error', error)
  return NextResponse.json({ error: 'Erro inesperado ao processar papéis documentais.' }, { status: 500 })
}
