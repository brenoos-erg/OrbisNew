import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { evaluateCodeAvailability } from '@/lib/iso-document-routing'
import { prisma } from '@/lib/prisma'

function normalizeCode(raw: string | null) {
  return String(raw ?? '').trim()
}

export async function GET(req: NextRequest) {
  await requireActiveUser()

  const code = normalizeCode(req.nextUrl.searchParams.get('code'))

  if (!code) {
    return NextResponse.json({ available: false, error: 'Informe um código para validação.' }, { status: 400 })
  }

  try {
    const document = await prisma.isoDocument.findUnique({
      where: { code },
      select: {
        id: true,
        versions: {
          orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { id: true, status: true, revisionNumber: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ available: true, message: 'Código disponível.' })
    }

    const feedback = evaluateCodeAvailability(
      code,
      document.versions[0]?.status ?? null,
      document.versions[0]?.revisionNumber ?? null,
    )
    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Erro ao validar código de documento ISO', error)
    return NextResponse.json({ error: 'Erro ao validar código do documento.' }, { status: 500 })
  }
}
