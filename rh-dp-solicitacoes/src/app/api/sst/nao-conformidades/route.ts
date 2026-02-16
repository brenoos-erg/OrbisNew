import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityOrigin, NonConformitySeverity, NonConformityStatus, NonConformityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function nextRncNumber() {
  const year = new Date().getFullYear()
  const value = await prisma.$transaction(async (tx) => {
    const seq = await tx.nonConformitySequence.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
      select: { lastValue: true },
    })
    return seq.lastValue
  })
  return `RNC-${year}-${String(value).padStart(4, '0')}`
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
    const q = searchParams.get('q')?.trim()

    const where: any = {}
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      where.solicitanteId = me.id
    }
    if (status && Object.values(NonConformityStatus).includes(status as NonConformityStatus)) {
      where.status = status as NonConformityStatus
    }
    if (q) {
      where.OR = [
        { numeroRnc: { contains: q } },
        { local: { contains: q } },
        { descricao: { contains: q } },
      ]
    }

    const items = await prisma.nonConformity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numeroRnc: true,
        status: true,
        tipo: true,
        classificacao: true,
        origem: true,
        local: true,
        dataOcorrencia: true,
        createdAt: true,
        solicitanteNome: true,
        responsavelTratativa: { select: { id: true, fullName: true } },
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
    const {
      tipo,
      classificacao,
      origem,
      local,
      data,
      descricao,
      acaoImediata,
      dataAcaoImediata,
      responsavelTratativaId,
    } = body

    if (!tipo || !classificacao || !origem || !local || !data || !descricao) {
      return NextResponse.json({ error: 'Preencha os campos obrigatórios.' }, { status: 400 })
    }

    if (!Object.values(NonConformityType).includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 })
    }
    if (!Object.values(NonConformitySeverity).includes(classificacao)) {
      return NextResponse.json({ error: 'Classificação inválida.' }, { status: 400 })
    }
    if (!Object.values(NonConformityOrigin).includes(origem)) {
      return NextResponse.json({ error: 'Origem inválida.' }, { status: 400 })
    }

    let responsavelTratativaConnect: { id: string } | undefined
    if (responsavelTratativaId) {
      if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
        return NextResponse.json({ error: 'Nível insuficiente para definir responsável.' }, { status: 403 })
      }
      const responsible = await prisma.user.findUnique({ where: { id: String(responsavelTratativaId) }, select: { id: true } })
      if (!responsible) {
        return NextResponse.json({ error: 'Responsável de tratativa não encontrado.' }, { status: 404 })
      }
      responsavelTratativaConnect = { id: responsible.id }
    }

    const numeroRnc = await nextRncNumber()

    const created = await prisma.nonConformity.create({
      data: {
        numeroRnc,
        tipo,
        classificacao,
        origem,
        local: String(local).trim(),
        dataOcorrencia: new Date(data),
        descricao: String(descricao).trim(),
        solicitanteId: me.id,
        solicitanteNome: me.fullName,
        solicitanteEmail: me.email,
        status: NonConformityStatus.ABERTA,
        acaoImediata: acaoImediata ? String(acaoImediata).trim() : null,
        dataAcaoImediata: dataAcaoImediata ? new Date(dataAcaoImediata) : null,
        responsavelTratativaId: responsavelTratativaConnect?.id ?? null,
        timeline: {
          create: {
            actorId: me.id,
            tipo: 'CRIACAO',
            toStatus: NonConformityStatus.ABERTA,
            message: 'Não conformidade registrada',
          },
        },
      },
      select: { id: true, numeroRnc: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades error', error)
    return NextResponse.json({ error: 'Erro ao criar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}