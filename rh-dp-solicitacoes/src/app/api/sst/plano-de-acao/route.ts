import { NextRequest, NextResponse } from 'next/server'
import {
  Action,
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
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { isActionOverdue, resolveAutomaticActionStatus } from '@/lib/sst/actionStatusAutomation'
import { notifyActionItemUpdate } from '@/lib/sst/actionPlanNotifications'
import { getUserSectorCostCenterIds } from '@/lib/sst/nonConformityAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toDateOnly(dateValue?: string | null) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDate(value: unknown) {
  if (value === undefined) return undefined
  if (!value) return null
  return new Date(String(value))
}

function toOptionalString(value: unknown) {
  if (value === undefined) return undefined
  const parsed = String(value || '').trim()
  return parsed || null
}

function toOptionalIntBetween(value: unknown, min = 1, max = 5) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined
  return parsed
}

function toOptionalDecimal(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function normalizeEvidenceText(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('/public/uploads/')) return line.replace('/public/uploads/', '/uploads/')
      if (line.startsWith('public/uploads/')) return `/${line.replace(/^public\//, '')}`
      if (line.startsWith('uploads/')) return `/${line}`
      return line
    })
    .join('\n')
  return normalized || null
}


export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.VIEW)

   const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const numeroProcesso = searchParams.get('numeroProcesso')?.trim()
    const status = searchParams.get('status')
    const responsavel = searchParams.get('responsavel')?.trim()
    const emAtraso = searchParams.get('emAtraso') === '1'
    const referencia = searchParams.get('referencia')?.trim()
    const centroResponsavelId = searchParams.get('centroResponsavelId')?.trim()
    const centroImpactadoId = searchParams.get('centroImpactadoId')?.trim()

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
      ...((q || numeroProcesso)
        ? {
            OR: [
              ...(q ? [{ descricao: { contains: q } }, { evidencias: { contains: q } }] : []),
              { referencia: { contains: numeroProcesso || q || '' } },
              { nonConformity: { numeroRnc: { contains: numeroProcesso || q || '' } } },
            ],
          }
        : {}),
      ...(referencia ? { referencia: { equals: referencia } } : {}),
      ...(centroResponsavelId ? { centroResponsavelId } : {}),
      ...(centroImpactadoId ? { centroImpactadoId } : {}),
    }

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      const userCenterIds = await getUserSectorCostCenterIds(me.id)
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [
        ...currentAnd,
        {
          OR: [
            { createdById: me.id },
            { responsavelId: me.id },
            { nonConformity: { solicitanteId: me.id } },
            { centroResponsavelId: { in: userCenterIds } },
            { centroImpactadoId: { in: userCenterIds } },
            { nonConformity: { centroQueDetectouId: { in: userCenterIds } } },
            { nonConformity: { centroQueOriginouId: { in: userCenterIds } } },
          ],
        },
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
        centroResponsavelId: true,
        centroImpactadoId: true,
        nonConformityId: true,
        referencia: true,
        origem: true,
        dataConclusao: true,
        rapidez: true,
        autonomia: true,
        beneficio: true,
        centroResponsavel: { select: { description: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        centroImpactado: { select: { description: true } },
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
          return (
            prazo < today &&
            isActionOverdue({
              prazo: item.prazo,
              dataConclusao: item.dataConclusao,
              status: item.status,
            })
          )
        })
      : items

    return NextResponse.json({ items: filtered, total: filtered.length })
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
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.CREATE)

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const descricao = String(body?.descricao || '').trim()
    if (!descricao) {
      return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
    }

    const dataInicioPrevista = toDate(body?.dataInicioPrevista)
    const dataFimPrevista = toDate(body?.dataFimPrevista)
    const prazo = body?.prazo ? new Date(String(body.prazo)) : dataFimPrevista
    const dataConclusao = toDate(body?.dataConclusao)
    const desiredStatus = resolveAutomaticActionStatus({
      requestedStatus: body?.status,
      prazo: prazo ?? null,
      dataInicioPrevista: dataInicioPrevista ?? null,
      dataConclusao: dataConclusao ?? null,
    })
    const evidencias = normalizeEvidenceText(body?.evidencias)
    if (desiredStatus === NonConformityActionStatus.CONCLUIDA && !evidencias) {
      return NextResponse.json({ error: 'Anexe evidência antes de concluir a ação.' }, { status: 400 })
    }

    const created = await prisma.nonConformityActionItem.create({
      data: {
        nonConformityId: null,
        origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO,
        createdById: me.id,
        descricao,
       motivoBeneficio: toOptionalString(body?.motivoBeneficio),
        atividadeComo: toOptionalString(body?.atividadeComo),
        centroImpactadoId: body?.centroImpactadoId ? String(body.centroImpactadoId) : null,

        centroResponsavelId: body?.centroResponsavelId ? String(body.centroResponsavelId) : null,
        dataInicioPrevista,
        dataFimPrevista,
        custo: toOptionalDecimal(body?.custo),
        dataConclusao,
        tipo: Object.values(NonConformityActionType).includes(body?.tipo as NonConformityActionType)
          ? (body.tipo as NonConformityActionType)
          : NonConformityActionType.ACAO_CORRETIVA,
        origem: toOptionalString(body?.origem) ?? 'PLANO AVULSO',
        referencia: toOptionalString(body?.referencia),
        rapidez: toOptionalIntBetween(body?.rapidez),
        autonomia: toOptionalIntBetween(body?.autonomia),
        beneficio: toOptionalIntBetween(body?.beneficio),
        responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
        responsavelNome: body?.responsavelNome ? String(body.responsavelNome).trim() : null,
        prazo,
        status: desiredStatus,
        evidencias,
      },
    })


    await notifyActionItemUpdate(created.id, 'STANDALONE_ACTION_CREATED')
    if (created.responsavelId) {
      await notifyActionItemUpdate(created.id, 'STANDALONE_ACTION_ASSIGNED')
    } else if (created.responsavelNome) {
      console.warn('Ação criada com responsável em texto livre; sem notificação automática por ausência de usuário vinculado.')
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar plano de ação avulso.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
