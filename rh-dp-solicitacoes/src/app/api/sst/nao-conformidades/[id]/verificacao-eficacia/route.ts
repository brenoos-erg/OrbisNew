import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel, NonConformityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Usuário não autenticado') {
    return { status: 401, error: message }
  }
  if (message === 'Usuário inativo') {
    return { status: 403, error: message }
  }
  if (message === 'Serviço indisponível. Não foi possível conectar ao banco de dados.') {
    return { status: 503, error: message }
  }

  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Somente qualidade (nível 2/3) pode registrar verificação de eficácia.' }, { status: 403 })
    }
    try {
      await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.VERIFICACAO_DE_EFICACIA, Action.UPDATE)
    } catch {
      return NextResponse.json({ error: 'Sem permissão para registrar verificação de eficácia.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const texto = String(body?.analiseQualidade || '').trim()
    if (!texto) return NextResponse.json({ error: 'Informe a análise da qualidade.' }, { status: 400 })

    const id = (await params).id
    const existing = await prisma.nonConformity.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }

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

    return NextResponse.json({ ok: true, item: updated })
  } catch (error: any) {
    const httpError = toHttpError(error)
    if (httpError) {
      return NextResponse.json({ error: httpError.error }, { status: httpError.status })
    }
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }
    console.error('Erro ao salvar verificação de eficácia da RNC:', error)
    return NextResponse.json({ error: 'Erro ao salvar verificação de eficácia.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
