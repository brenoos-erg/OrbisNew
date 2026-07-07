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
} from '../../helpers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    await ensurePlanAccess(Action.VIEW)
    const { planId } = await params
    const items = await prisma.nonConformityActionItem.findMany({
      where: { qualityActionPlanId: planId, nonConformityId: null, origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO },
      orderBy: [{ createdAt: 'asc' }],
      include: { centroResponsavel: { select: { description: true } }, centroImpactado: { select: { description: true } } },
    })
    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    return NextResponse.json({ error: 'Erro ao listar ações do plano.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const me = await ensurePlanAccess(Action.CREATE)
    const { planId } = await params
    const plan = await prisma.qualityActionPlan.findUnique({ where: { id: planId }, select: { id: true, numeroPlano: true } })
    if (!plan) return NextResponse.json({ error: 'Plano avulso não encontrado.' }, { status: 404 })
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const descricao = String(body?.descricao || body?.oQue || '').trim()
    if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
    const dataFimPrevista = toDate(body?.dataFimPrevista)
    const created = await prisma.nonConformityActionItem.create({
      data: {
        qualityActionPlanId: planId,
        nonConformityId: null,
        origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO,
        createdById: me.id,
        descricao,
        motivoBeneficio: toOptionalString(body?.motivoBeneficio),
        atividadeComo: toOptionalString(body?.atividadeComo),
        origem: toOptionalString(body?.origem) ?? 'PLANO AVULSO',
        referencia: toOptionalString(body?.referencia) ?? plan.numeroPlano,
        centroResponsavelId: body?.centroResponsavelId ? String(body.centroResponsavelId) : null,
        centroImpactadoId: body?.centroImpactadoId ? String(body.centroImpactadoId) : null,
        responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
        responsavelNome: toOptionalString(body?.responsavelNome),
        dataInicioPrevista: toDate(body?.dataInicioPrevista),
        dataFimPrevista,
        prazo: toDate(body?.prazo) ?? dataFimPrevista,
        status: Object.values(NonConformityActionStatus).includes(body?.status as NonConformityActionStatus) ? (body.status as NonConformityActionStatus) : NonConformityActionStatus.PENDENTE,
        tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType) ? (body.tipo as NonConformityActionType) : NonConformityActionType.ACAO_CORRETIVA,
        dataConclusao: toDate(body?.dataConclusao),
        custo: toOptionalDecimal(body?.custo),
        rapidez: toOptionalNumber(body?.rapidez, 1, 5),
        autonomia: toOptionalNumber(body?.autonomia, 1, 5),
        beneficio: toOptionalNumber(body?.beneficio, 1, 5),
        evidencias: normalizeEvidenceText(body?.evidencias),
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    return NextResponse.json({ error: 'Erro ao criar ação do plano.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
