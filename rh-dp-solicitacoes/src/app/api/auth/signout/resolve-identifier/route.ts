import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const identifier = (req.nextUrl.searchParams.get('identifier') ?? '').trim().toLowerCase()

  if (!identifier) {
    return NextResponse.json({ error: 'Identificador obrigatório.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { login: identifier },
        { email: identifier },
      ],
    },
    select: { email: true },
  })

  if (!user?.email) {
    return NextResponse.json({ error: 'Login não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({ email: user.email })
}