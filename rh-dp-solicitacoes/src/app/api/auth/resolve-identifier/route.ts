export const dynamic = 'force-dynamic'
export const revalidate = 0

export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isDbUnavailableError } from '@/lib/db-unavailable'

const isDbDisabled = process.env.SKIP_PRISMA_DB === 'true'
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
      const requestId = crypto.randomUUID()
      console.warn('Banco de dados desabilitado ao resolver login', { requestId })
      return NextResponse.json(
        {
          error: 'Banco de dados desabilitado neste ambiente (SKIP_PRISMA_DB=true).',
          dbUnavailable: true,
          requestId,
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
    const requestId = crypto.randomUUID()

    console.error('Error resolving identifier', { requestId, error })

    return NextResponse.json(
      { error: message, dbUnavailable, requestId },
      { status: dbUnavailable ? 503 : 500 },
    )
  }
}
