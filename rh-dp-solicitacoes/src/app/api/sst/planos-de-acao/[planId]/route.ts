import { NextRequest, NextResponse } from 'next/server'
import { Action, QualityActionPlanStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { createLegacyPlanForAction, ensurePlanAccess, serializePlan, toDate, toOptionalDecimal, toOptionalString } from '../helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const me = await ensurePlanAccess(Action.VIEW)
    const { planId } = await params
    const plan = await prisma.qualityActionPlan.findUnique({
      where: { id: planId },
      include: {
        actions: true,
        centroResponsavel: { select: { description: true } },
        centroImpactado: { select: { description: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    })

    if (plan) return NextResponse.json({ item: serializePlan(plan) })

    const legacyPlanId = await createLegacyPlanForAction(planId, me.id)
    if (legacyPlanId) {
      return NextResponse.redirect(new URL(`/dashboard/sgi/qualidade/planos-de-acao/${legacyPlanId}`, req.url))
    }

    return NextResponse.json({ error: 'Plano avulso não encontrado.' }, { status: 404 })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erro ao carregar plano avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    await ensurePlanAccess(Action.UPDATE)
    const { planId } = await params
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const updated = await prisma.qualityActionPlan.update({
      where: { id: planId },
      data: {
        titulo: body?.titulo !== undefined ? String(body.titulo || '').trim() : undefined,
        objetivo: toOptionalString(body?.objetivo),
        resultadoEsperado: toOptionalString(body?.resultadoEsperado),
        origem: toOptionalString(body?.origem),
        referencia: toOptionalString(body?.referencia),
        status: Object.values(QualityActionPlanStatus).includes(body?.status as QualityActionPlanStatus)
          ? (body.status as QualityActionPlanStatus)
          : undefined,
        responsavelId: body?.responsavelId !== undefined ? (body.responsavelId ? String(body.responsavelId) : null) : undefined,
        responsavelNome: toOptionalString(body?.responsavelNome),
        centroResponsavelId: body?.centroResponsavelId !== undefined ? (body.centroResponsavelId ? String(body.centroResponsavelId) : null) : undefined,
        centroImpactadoId: body?.centroImpactadoId !== undefined ? (body.centroImpactadoId ? String(body.centroImpactadoId) : null) : undefined,
        dataInicioPrevista: toDate(body?.dataInicioPrevista),
        dataFimPrevista: toDate(body?.dataFimPrevista),
        dataConclusao: toDate(body?.dataConclusao),
        investimento: toOptionalDecimal(body?.investimento),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar plano avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    await ensurePlanAccess(Action.DELETE)
    const { planId } = await params
    const count = await prisma.nonConformityActionItem.count({ where: { qualityActionPlanId: planId } })

    if (count === 0) {
      await prisma.qualityActionPlan.delete({ where: { id: planId } })
      return NextResponse.json({ ok: true, deleted: true })
    }

    const updated = await prisma.qualityActionPlan.update({ where: { id: planId }, data: { status: QualityActionPlanStatus.CANCELADO } })
    return NextResponse.json({ ok: true, item: updated })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erro ao excluir plano avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
