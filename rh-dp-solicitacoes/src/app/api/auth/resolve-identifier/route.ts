export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    const user = await prisma.user.findFirst({
      where: {
        status: 'ATIVO',
        OR: [{ login: identifier }, { email: identifier }],
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
    console.error('Error resolving identifier', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}