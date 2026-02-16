import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    if (!hasMinLevel(normalizeSstLevel(levels), ModuleLevel.NIVEL_3)) {
      return NextResponse.json({ error: 'Somente nível 3 pode aprovar verificação de eficácia.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const texto = String(body?.texto || '').trim()
    const data = body?.data ? new Date(body.data) : new Date()

    if (!texto) return NextResponse.json({ error: 'Texto da verificação é obrigatório.' }, { status: 400 })

    const id = (await params).id
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.nonConformity.update({
        where: { id },
        data: {
          verificacaoEficaciaTexto: texto,
          verificacaoEficaciaData: data,
          verificacaoEficaciaAprovadoPorId: me.id,
          status: NonConformityStatus.ENCERRADA,
        },
      })

      await tx.nonConformityTimeline.create({
        data: {
          nonConformityId: id,
          actorId: me.id,
          tipo: 'VERIFICACAO_EFICACIA',
          fromStatus: row.status,
          toStatus: NonConformityStatus.ENCERRADA,
          message: 'Verificação de eficácia aprovada e NC encerrada',
        },
      })
      return row
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades/[id]/verificacao-eficacia error', error)
    return NextResponse.json({ error: 'Erro ao registrar verificação de eficácia.' }, { status: 500 })
  }
}