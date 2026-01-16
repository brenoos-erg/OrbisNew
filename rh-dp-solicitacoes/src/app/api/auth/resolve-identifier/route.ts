export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const isDbDisabled = process.env.SKIP_PRISMA_DB === 'true'
const dbUnavailableCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1011',
  'P1012',
  'P1013',
  'P1017',
  'P2024',
])

function isDbUnavailableError(error: unknown) {
  return (
    isDbDisabled ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      dbUnavailableCodes.has(error.code))
  )
}


export async function GET(req: NextRequest) {
  try {
    const identifierParam = req.nextUrl.searchParams.get('identifier')

    if (!identifierParam) {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
    }

    const identifier = identifierParam.trim().toLowerCase()

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
    }
    if (isDbDisabled) {
      return NextResponse.json(
        {
          error: 'Banco de dados desabilitado neste ambiente (SKIP_PRISMA_DB=true).',
          dbUnavailable: true,
        },
        { status: 503 },
      )
    }
    const user = await prisma.user.findFirst({
      where: {
        status: 'ATIVO',
        OR: [
          { login: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: {
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ email: user.email })
  } catch (error) {
    const dbUnavailable = isDbUnavailableError(error)
    const message = dbUnavailable
      ? 'Banco de dados indisponível. Confira DATABASE_URL no Vercel ou tente novamente em instantes.'
      : 'Internal server error'

    console.error('Error resolving identifier', error)

    return NextResponse.json({ error: message, dbUnavailable }, { status: dbUnavailable ? 503 : 500 })
  }
}
