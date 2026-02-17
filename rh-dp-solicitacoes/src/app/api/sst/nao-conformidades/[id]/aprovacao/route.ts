import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityApprovalStatus, NonConformityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { normalizeSstLevel } from '@/lib/sst/access'
import { canApproveNc } from '@/lib/sst/nonConformity'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!canApproveNc(level)) {
      return NextResponse.json({ error: 'Somente qualidade (nível 2/3) pode aprovar ou reprovar.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const aprovado = Boolean(body?.aprovado)
    const observacao = body?.observacao ? String(body.observacao).trim() : null
    const id = (await params).id

    const status = aprovado ? NonConformityStatus.APROVADA_QUALIDADE : NonConformityStatus.AGUARDANDO_APROVACAO_QUALIDADE
    const approvalStatus = aprovado ? NonConformityApprovalStatus.APROVADO : NonConformityApprovalStatus.REPROVADO

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.nonConformity.update({
        where: { id },
        data: {
          aprovadoQualidadeStatus: approvalStatus,
          aprovadoQualidadePorId: me.id,
          aprovadoQualidadeEm: new Date(),
          aprovadoQualidadeObservacao: observacao,
          status,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'APROVACAO_QUALIDADE',
        fromStatus: row.status,
        toStatus: status,
        message: aprovado ? 'Aprovação da qualidade concluída' : 'Não conformidade reprovada pela qualidade',
      })

      return row
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao processar aprovação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}