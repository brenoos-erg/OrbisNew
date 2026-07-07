import { NextRequest, NextResponse } from 'next/server'
import { Action, NonConformityActionPlanOrigin, NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import {
  ensurePlanAccess,
  normalizeEvidenceText,
  toDate,
  toOptionalDecimal,
  toOptionalNumber,
  toOptionalString,
} from '../../../helpers'

function actionWhere(planId: string, actionId: string) {
  return { id: actionId, qualityActionPlanId: planId, nonConformityId: null, origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ planId: string; actionId: string }> }) {
  try {
    await ensurePlanAccess(Action.UPDATE)
    const { planId, actionId } = await params
    const current = await prisma.nonConformityActionItem.findFirst({ where: actionWhere(planId, actionId) })
    if (!current) return NextResponse.json({ error: 'Ação não encontrada neste plano avulso.' }, { status: 404 })
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const status = Object.values(NonConformityActionStatus).includes(body?.status as NonConformityActionStatus) ? (body.status as NonConformityActionStatus) : undefined
    const updated = await prisma.nonConformityActionItem.update({
      where: { id: actionId },
      data: {
        descricao: body?.descricao !== undefined ? String(body.descricao || '').trim() : undefined,
        motivoBeneficio: toOptionalString(body?.motivoBeneficio),
        atividadeComo: toOptionalString(body?.atividadeComo),
        origem: toOptionalString(body?.origem),
        centroResponsavelId: body?.centroResponsavelId !== undefined ? (body.centroResponsavelId ? String(body.centroResponsavelId) : null) : undefined,
        centroImpactadoId: body?.centroImpactadoId !== undefined ? (body.centroImpactadoId ? String(body.centroImpactadoId) : null) : undefined,
        responsavelId: body?.responsavelId !== undefined ? (body.responsavelId ? String(body.responsavelId) : null) : undefined,
        responsavelNome: toOptionalString(body?.responsavelNome),
        dataInicioPrevista: toDate(body?.dataInicioPrevista),
        dataFimPrevista: toDate(body?.dataFimPrevista),
        prazo: toDate(body?.prazo),
        status,
        tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType) ? (body.tipo as NonConformityActionType) : undefined,
        dataConclusao: status === NonConformityActionStatus.CONCLUIDA
          ? (toDate(body?.dataConclusao) ?? new Date())
          : status === NonConformityActionStatus.PENDENTE || status === NonConformityActionStatus.EM_ANDAMENTO
            ? null
            : toDate(body?.dataConclusao),
        custo: toOptionalDecimal(body?.custo),
        rapidez: toOptionalNumber(body?.rapidez, 1, 5),
        autonomia: toOptionalNumber(body?.autonomia, 1, 5),
        beneficio: toOptionalNumber(body?.beneficio, 1, 5),
        evidencias: body?.evidencias !== undefined ? normalizeEvidenceText(body.evidencias) : undefined,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    return NextResponse.json({ error: 'Erro ao atualizar ação do plano.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ planId: string; actionId: string }> }) {
  try {
    await ensurePlanAccess(Action.DELETE)
    const { planId, actionId } = await params
    const current = await prisma.nonConformityActionItem.findFirst({ where: actionWhere(planId, actionId), select: { id: true } })
    if (!current) return NextResponse.json({ error: 'Ação não encontrada neste plano avulso.' }, { status: 404 })
    await prisma.nonConformityActionItem.delete({ where: { id: actionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    return NextResponse.json({ error: 'Erro ao excluir ação do plano.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
