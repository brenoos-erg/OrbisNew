import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Somente qualidade (nível 2/3) pode registrar verificação de eficácia.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const texto = String(body?.analiseQualidade || '').trim()
    if (!texto) return NextResponse.json({ error: 'Texto da análise é obrigatório.' }, { status: 400 })

    const id = (await params).id
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.nonConformity.findUnique({ where: { id }, select: { status: true } })
      if (!current) throw new Error('NOT_FOUND')

      const row = await tx.nonConformity.update({
        where: { id },
        data: {
          verificacaoEficaciaTexto: texto,
          verificacaoEficaciaData: new Date(),
          verificacaoEficaciaAprovadoPorId: me.id,
          status: NonConformityStatus.ENCERRADA,
          fechamentoEm: new Date(),
        },
      })

        await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'FECHAMENTO',
        fromStatus: current.status,
        toStatus: NonConformityStatus.ENCERRADA,
        message: 'Verificação de eficácia registrada e NC encerrada',
      })
      return row
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao registrar verificação de eficácia.', detail: devErrorDetail(error) }, { status: 500 })
  }
}