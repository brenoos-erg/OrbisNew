import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityApprovalStatus, NonConformityStatus, NonConformityType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseGutValue(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null
  return parsed
}

async function nextRncNumber(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear()
  const seq = await tx.nonConformitySequence.upsert({
    where: { year },
    update: { lastValue: { increment: 1 } },
    create: { year, lastValue: 1 },
    select: { lastValue: true },
  })
  return `RNC-${year}-${String(seq.lastValue).padStart(4, '0')}`
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
    const status = searchParams.get('status')
    const tipoNc = searchParams.get('tipoNc')
    const centroQueDetectouId = searchParams.get('centroQueDetectouId')
    const centroQueOriginouId = searchParams.get('centroQueOriginouId')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const q = searchParams.get('q')?.trim()

    const where: any = {}
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      where.solicitanteId = me.id
    }
    if (status && Object.values(NonConformityStatus).includes(status as NonConformityStatus)) {
      where.status = status as NonConformityStatus
    }
    if (tipoNc && Object.values(NonConformityType).includes(tipoNc as NonConformityType)) {
      where.tipoNc = tipoNc as NonConformityType
    }
    if (centroQueDetectouId) where.centroQueDetectouId = centroQueDetectouId
    if (centroQueOriginouId) where.centroQueOriginouId = centroQueOriginouId
    if (dataInicio || dataFim) {
      where.createdAt = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim) } : {}),
      }
    }
     if (q) {
      where.OR = [
        { numeroRnc: { contains: q } },
        { descricao: { contains: q } },
        { evidenciaObjetiva: { contains: q } },
      ]
    }


    const items = await prisma.nonConformity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numeroRnc: true,
        status: true,
        tipoNc: true,
        createdAt: true,
        prazoAtendimento: true,
        solicitanteNome: true,
        aprovadoQualidadeStatus: true,
        centroQueDetectou: { select: { id: true, description: true } },
        centroQueOriginou: { select: { id: true, description: true } },
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/sst/nao-conformidades error', error)
    return NextResponse.json({ error: 'Erro ao listar não conformidades.', detail: devErrorDetail(error) }, { status: 500 })
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

    const body = await req.json().catch(() => ({} as any))
     const descricao = String(body?.descricao || '').trim()
    const evidenciaObjetiva = String(body?.evidenciaObjetiva || '').trim()
    const centroQueDetectouId = String(body?.centroQueDetectouId || '').trim()
    const centroQueOriginouId = String(body?.centroQueOriginouId || '').trim()

    if (!descricao || !evidenciaObjetiva || !centroQueDetectouId || !centroQueOriginouId) {
      return NextResponse.json({ error: 'Descrição, evidência objetiva e centros são obrigatórios.' }, { status: 400 })
    }

    const tipoNc = body?.tipoNc && Object.values(NonConformityType).includes(body.tipoNc)
      ? body.tipoNc as NonConformityType
      : NonConformityType.OUTROS
    const gravidade = parseGutValue(body?.gravidade)
    const urgencia = parseGutValue(body?.urgencia)
    const tendencia = parseGutValue(body?.tendencia)

    const [detected, origin] = await Promise.all([
      prisma.costCenter.findUnique({ where: { id: centroQueDetectouId }, select: { id: true } }),
      prisma.costCenter.findUnique({ where: { id: centroQueOriginouId }, select: { id: true } }),
    ])

    if (!detected || !origin) {
      return NextResponse.json({ error: 'Centro de custo inválido.' }, { status: 400 })
    }

      const created = await prisma.$transaction(async (tx) => {
      const numeroRnc = await nextRncNumber(tx)
      const createdAt = new Date()
      const prazoAtendimento = new Date(createdAt)
      prazoAtendimento.setDate(prazoAtendimento.getDate() + 90)

      const created = await tx.nonConformity.create({
        data: {
          numeroRnc,
          tipoNc,
          descricao,
          evidenciaObjetiva,
          empresa: 'ERG ENGENHARIA',
          centroQueDetectouId,
          centroQueOriginouId,
          prazoAtendimento,
          referenciaSig: body?.referenciaSig ? String(body.referenciaSig).trim() : null,
          acoesImediatas: body?.acoesImediatas ? String(body.acoesImediatas).trim() : null,
          gravidade,
          urgencia,
          tendencia,
          solicitanteId: me.id,
          solicitanteNome: me.fullName,
          solicitanteEmail: me.email,
          status: NonConformityStatus.AGUARDANDO_APROVACAO_QUALIDADE,
          aprovadoQualidadeStatus: NonConformityApprovalStatus.PENDENTE,
        },
        select: { id: true, numeroRnc: true },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: created.id,
        actorId: me.id,
        tipo: 'CRIACAO',
        toStatus: NonConformityStatus.AGUARDANDO_APROVACAO_QUALIDADE,
        message: 'Não conformidade registrada e enviada para aprovação da qualidade',
      })

      return created
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades error', error)
    return NextResponse.json({ error: 'Erro ao criar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}