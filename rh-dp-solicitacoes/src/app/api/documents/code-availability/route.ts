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
    const documents = await prisma.isoDocument.findMany({
      where: { OR: [{ activeCode: code }, { code }] },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        isActive: true,
        activeCode: true,
        inactiveReason: true,
        versions: {
          orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { id: true, status: true, revisionNumber: true },
        },
      },
    })

    const activeDocument = documents.find((item) => item.activeCode === code || (item.isActive && item.activeCode === null && item.versions.length > 0))
    if (activeDocument) {
      const feedback = evaluateCodeAvailability(
        code,
        activeDocument.versions[0]?.status ?? null,
        activeDocument.versions[0]?.revisionNumber ?? null,
      )
      return NextResponse.json(feedback)
    }

    if (documents.length > 0 && documents.every((item) => String(item.inactiveReason ?? '').includes('POSTING_ERROR'))) {
      return NextResponse.json({
        available: true,
        isRevision: false,
        currentRevisionNumber: null,
        message: 'Código disponível para novo cadastro. Documento anterior foi excluído por erro de postagem.',
      })
    }

    if (documents.length > 0) {
      const latest = documents[0]
      const feedback = evaluateCodeAvailability(
        code,
        latest.versions[0]?.status ?? null,
        latest.versions[0]?.revisionNumber ?? null,
      )
      return NextResponse.json(feedback)
    }

    return NextResponse.json({ available: true, isRevision: false, currentRevisionNumber: null, message: 'Código disponível.' })
  } catch (error) {
    console.error('Erro ao validar código de documento ISO', error)
    return NextResponse.json({ error: 'Erro ao validar código do documento.' }, { status: 500 })
  }
}
