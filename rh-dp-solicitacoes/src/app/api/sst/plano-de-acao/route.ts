import { NextRequest, NextResponse } from 'next/server'
import {
  ModuleLevel,
  NonConformityActionPlanOrigin,
  NonConformityActionStatus,
  NonConformityActionType,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toDateOnly(dateValue?: string | null) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const status = searchParams.get('status')
    const responsavel = searchParams.get('responsavel')?.trim()
    const emAtraso = searchParams.get('emAtraso') === '1'

    const where: Prisma.NonConformityActionItemWhereInput = {
      ...(status && Object.values(NonConformityActionStatus).includes(status as NonConformityActionStatus)
        ? { status: status as NonConformityActionStatus }
        : {}),
      ...(responsavel
        ? {
            responsavelNome: {
              contains: responsavel,
            },
          }
        : {}),
      ...(q
        ? {
               OR: [
              { descricao: { contains: q } },
              { evidencias: { contains: q } },
              { referencia: { contains: q } },
              { nonConformity: { numeroRnc: { contains: q } } },
            ],
          }
        : {}),
    }

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      where.OR = [
        ...(where.OR ?? []),
        { createdById: me.id },
        { responsavelId: me.id },
        { nonConformity: { solicitanteId: me.id } },
      ]
    }

     const items = await prisma.nonConformityActionItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        descricao: true,
        responsavelNome: true,
        prazo: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        origemPlano: true,
        nonConformityId: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        nonConformity: {
          select: {
            id: true,
            numeroRnc: true,
            status: true,
            centroQueOriginou: { select: { description: true } },
            centroQueDetectou: { select: { description: true } },
          },
        },
      },
    })

    const today = toDateOnly(new Date().toISOString())
    const filtered = emAtraso
      ? items.filter((item) => {
          const prazo = toDateOnly(item.prazo?.toISOString())
          if (!prazo || !today) return false
          if (
            item.status === NonConformityActionStatus.CONCLUIDA ||
            item.status === NonConformityActionStatus.CANCELADA
          ) {
            return false
          }
          return prazo < today
        })
      : items

    return NextResponse.json({ items: filtered })
  } catch (error) {
    console.error('GET /api/sst/planos-de-acao error', error)
    return NextResponse.json({ error: 'Erro ao listar planos de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const descricao = String(body?.descricao || '').trim()
    if (!descricao) {
      return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
    }

    const created = await prisma.nonConformityActionItem.create({
      data: {
        nonConformityId: null,
        origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO,
        createdById: me.id,
        descricao,
        motivoBeneficio: body?.motivoBeneficio ? String(body.motivoBeneficio).trim() : null,
        atividadeComo: body?.atividadeComo ? String(body.atividadeComo).trim() : null,
        centroImpactadoId: body?.centroImpactadoId ? String(body.centroImpactadoId) : null,
        centroImpactadoDescricao: body?.centroImpactadoDescricao ? String(body.centroImpactadoDescricao).trim() : null,
        centroResponsavelId: body?.centroResponsavelId ? String(body.centroResponsavelId) : null,
        dataInicioPrevista: body?.dataInicioPrevista ? new Date(String(body.dataInicioPrevista)) : null,
        dataFimPrevista: body?.dataFimPrevista ? new Date(String(body.dataFimPrevista)) : null,
        custo: body?.custo ? Number(body.custo) : null,
        dataConclusao: body?.dataConclusao ? new Date(String(body.dataConclusao)) : null,
        tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType)
          ? (body.tipo as NonConformityActionType)
          : NonConformityActionType.ACAO_CORRETIVA,
        origem: body?.origem ? String(body.origem).trim() : 'PLANO AVULSO',
        referencia: body?.referencia ? String(body.referencia).trim() : null,
        rapidez: body?.rapidez ? Number(body.rapidez) : null,
        autonomia: body?.autonomia ? Number(body.autonomia) : null,
        beneficio: body?.beneficio ? Number(body.beneficio) : null,
        responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
        responsavelNome: body?.responsavelNome ? String(body.responsavelNome).trim() : null,
        prazo: body?.prazo ? new Date(String(body.prazo)) : null,
        status: Object.values(NonConformityActionStatus).includes(body?.status as NonConformityActionStatus)
          ? (body.status as NonConformityActionStatus)
          : NonConformityActionStatus.PENDENTE,
        evidencias: body?.evidencias ? String(body.evidencias).trim() : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar plano de ação avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}