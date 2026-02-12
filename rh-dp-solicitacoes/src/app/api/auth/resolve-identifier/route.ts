export const dynamic = 'force-dynamic'
export const revalidate = 0

export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isDbUnavailableError } from '@/lib/db-unavailable'
import { jsonApiError } from '@/lib/api-error'

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
      return jsonApiError({
        status: 503,
        message: 'Banco de dados desabilitado neste ambiente (SKIP_PRISMA_DB=true).',
        dbUnavailable: true,
        requestId,
      })
    }
    const user = await prisma.user.findFirst({
      where: {
        status: 'ATIVO',
        OR: [
          { login: { equals: identifier } },
          { email: { equals: identifier } },
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

    return jsonApiError({
      status: dbUnavailable ? 503 : 500,
      message,
      dbUnavailable,
      requestId,
    })
  }
}
