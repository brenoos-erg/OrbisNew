import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams
  const identifier = searchParams.get('identifier')?.trim()
  const skipPrismaFlags =
    process.env.SKIP_PRISMA_MIGRATE === 'true' ||
    process.env.SKIP_PRISMA_DB === 'true'
  const isProd = process.env.NODE_ENV === 'production'

  if (!identifier) {
    return NextResponse.json(
      { error: 'Parâmetro "identifier" é obrigatório.' },
      { status: 400 },
    )
  }

  if (skipPrismaFlags && !isProd) {
    console.warn(
      'SKIP_PRISMA_MIGRATE/DB está ativo; não será possível resolver o identificador.',
    )
    return NextResponse.json(
      { error: 'Banco de dados indisponível para resolver identificador.', dbUnavailable: true },
      { status: 503 },
    )
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { login: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ email: user.email })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Falha ao conectar ao banco de dados para resolver identificador', error)
      return NextResponse.json(
        { error: 'Serviço indisponível. Não foi possível consultar o banco de dados.', dbUnavailable: true },
        { status: 503 },
      )
    }

    console.error('Erro ao resolver identificador de login/e-mail', error)
    return NextResponse.json(
      { error: 'Erro ao resolver identificador.' },
      { status: 500 },
    )
  }
}