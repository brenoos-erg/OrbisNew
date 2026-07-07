import { NextRequest, NextResponse } from 'next/server'
import { Action, Prisma, QualityActionPlanStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { ensurePlanAccess, nextPlanNumber, serializePlan, toDate, toOptionalDecimal, toOptionalString } from './helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    await ensurePlanAccess(Action.VIEW)
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || searchParams.get('numeroProcesso')?.trim() || ''
    const status = searchParams.get('status')
    const responsavel = searchParams.get('responsavel')?.trim()
    const centroResponsavelId = searchParams.get('centroResponsavelId')?.trim()
    const centroImpactadoId = searchParams.get('centroImpactadoId')?.trim()

    const where: Prisma.QualityActionPlanWhereInput = {
      ...(status && Object.values(QualityActionPlanStatus).includes(status as QualityActionPlanStatus)
        ? { status: status as QualityActionPlanStatus }
        : {}),
      ...(q
        ? { OR: [{ numeroPlano: { contains: q } }, { titulo: { contains: q } }, { referencia: { contains: q } }] }
        : {}),
      ...(responsavel ? { responsavelNome: { contains: responsavel } } : {}),
      ...(centroResponsavelId ? { centroResponsavelId } : {}),
      ...(centroImpactadoId ? { centroImpactadoId } : {}),
    }

    const plans = await prisma.qualityActionPlan.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        actions: true,
        centroResponsavel: { select: { description: true } },
        centroImpactado: { select: { description: true } },
      },
    })

    const items = plans
      .map(serializePlan)
      .filter((plan) => (searchParams.get('emAtraso') === '1' ? plan.acoesEmAtraso > 0 : true))

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erro ao listar planos de ação avulsos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await ensurePlanAccess(Action.CREATE)
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const titulo = String(body?.titulo || '').trim()

    if (!titulo) {
      return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 })
    }

    const created = await prisma.qualityActionPlan.create({
      data: {
        numeroPlano: await nextPlanNumber(),
        titulo,
        objetivo: toOptionalString(body?.objetivo),
        resultadoEsperado: toOptionalString(body?.resultadoEsperado),
        origem: toOptionalString(body?.origem),
        referencia: toOptionalString(body?.referencia),
        status: QualityActionPlanStatus.ABERTO,
        createdById: me.id,
        responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
        responsavelNome: toOptionalString(body?.responsavelNome),
        centroResponsavelId: body?.centroResponsavelId ? String(body.centroResponsavelId) : null,
        centroImpactadoId: body?.centroImpactadoId ? String(body.centroImpactadoId) : null,
        dataInicioPrevista: toDate(body?.dataInicioPrevista),
        dataFimPrevista: toDate(body?.dataFimPrevista),
        investimento: toOptionalDecimal(body?.investimento),
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'NO_ACCESS') {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erro ao criar plano de ação avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
