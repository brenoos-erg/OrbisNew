export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma, SolicitationPriority, SolicitationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canAccessTiOperationalPanel, computeTiDueDate, isTiCatalogCode } from '@/lib/tiSolicitations'
import { normalizeFilterText } from '@/lib/solicitationFilters'

const TI_OPERATIONAL_STATUS = [
  'ABERTA',
  'AGUARDANDO_APROVACAO',
  'TRIAGEM_TI',
  'EM_ATENDIMENTO',
  'AGUARDANDO_USUARIO',
  'AGUARDANDO_TERCEIRO',
  'RESOLVIDA',
  'CONCLUIDA',
  'CANCELADA',
] as const

function toSlaState(dataPrevista: Date | null, status: SolicitationStatus) {
  if (!dataPrevista || ['CONCLUIDA', 'CANCELADA'].includes(status)) return 'SEM_SLA'
  return dataPrevista.getTime() < Date.now() ? 'VENCIDO' : 'NO_PRAZO'
}

async function assertTiPanelAccess() {
  const me = await requireActiveUser()
  const allowed = canAccessTiOperationalPanel({
    role: me.role,
    departmentCode: me.department?.code,
    moduleLevels: me.moduleLevels,
  })
  if (!allowed) throw new Error('Acesso negado ao painel operacional de TI.')
  return me
}

export async function GET(req: NextRequest) {
  try {
    await assertTiPanelAccess()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20
    const where: Prisma.SolicitationWhereInput = {
      tipo: { codigo: { in: ['RQ.TI.001', 'RQ.TI.002', 'RQ.TI.003', 'RQ.TI.004', 'RQ.TI.005', 'RQ.TI.006', 'RQ.TI.007'] } },
    }

    const protocolo = normalizeFilterText(searchParams.get('protocolo'))
    const tipoId = searchParams.get('tipoId')
    const status = normalizeFilterText(searchParams.get('status'))
    const prioridade = normalizeFilterText(searchParams.get('prioridade'))
    const categoria = normalizeFilterText(searchParams.get('categoria'))
    const solicitante = normalizeFilterText(searchParams.get('solicitante'))
    const responsavel = normalizeFilterText(searchParams.get('responsavel'))

    if (protocolo) where.protocolo = { contains: protocolo }
    if (tipoId) where.tipoId = tipoId
    if (status) where.status = status as SolicitationStatus
    if (prioridade) where.prioridade = prioridade as SolicitationPriority
    if (categoria) {
      const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [...andFilters, { payload: { path: '$.campos.categoria', string_contains: categoria } }]
    }
    if (solicitante) where.solicitante = { fullName: { contains: solicitante } }
    if (responsavel) {
      const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [
        ...andFilters,
        {
          OR: [
            { assumidaPor: { fullName: { contains: responsavel } } },
            { approver: { fullName: { contains: responsavel } } },
          ],
        },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.solicitation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ updatedAt: 'desc' }, { dataAbertura: 'desc' }],
        include: {
          tipo: { select: { id: true, codigo: true, nome: true } },
          solicitante: { select: { fullName: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          anexos: { select: { id: true, filename: true, createdAt: true }, take: 3, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.solicitation.count({ where }),
    ])

    const stats = rows.reduce(
      (acc, row) => {
        if (row.status === 'ABERTA') acc.abertos += 1
        if ((row.payload as any)?.metadata?.tiStatus === 'TRIAGEM_TI') acc.triagem += 1
        if (row.status === 'EM_ATENDIMENTO') acc.emAtendimento += 1
        if ((row.payload as any)?.metadata?.tiStatus === 'AGUARDANDO_USUARIO') acc.aguardandoUsuario += 1
        if (row.status === 'AGUARDANDO_APROVACAO') acc.aguardandoAprovacao += 1
        if (row.status === 'CONCLUIDA') acc.concluidos += 1
        if (row.prioridade === 'URGENTE') acc.criticos += 1
        if (toSlaState(row.dataPrevista, row.status) === 'VENCIDO') acc.vencidos += 1
        return acc
      },
      { abertos: 0, triagem: 0, emAtendimento: 0, aguardandoUsuario: 0, aguardandoAprovacao: 0, concluidos: 0, criticos: 0, vencidos: 0 },
    )

    return NextResponse.json({
      statuses: TI_OPERATIONAL_STATUS,
      rows: rows.map((row) => ({
        id: row.id,
        protocolo: row.protocolo,
        titulo: row.titulo,
        status: row.status,
        tiStatus: (row.payload as any)?.metadata?.tiStatus ?? null,
        prioridade: row.prioridade,
        dataAbertura: row.dataAbertura,
        dataPrevista: row.dataPrevista,
        dataFechamento: row.dataFechamento,
        tipo: row.tipo,
        solicitante: row.solicitante,
        assumidaPor: row.assumidaPor,
        anexos: row.anexos,
        categoria: (row.payload as any)?.campos?.categoria ?? null,
        slaState: toSlaState(row.dataPrevista, row.status),
      })),
      total,
      stats,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar painel TI.'
    const status = message.includes('Acesso negado') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await assertTiPanelAccess()
    const body = await req.json().catch(() => null)
    const solicitationId = String(body?.solicitationId ?? '')
    const action = String(body?.action ?? '').toLowerCase()
    if (!solicitationId || !action) return NextResponse.json({ error: 'solicitationId e action são obrigatórios.' }, { status: 400 })

    const solicitation = await prisma.solicitation.findUnique({ where: { id: solicitationId }, include: { tipo: { select: { codigo: true } } } })
    if (!solicitation || !isTiCatalogCode(solicitation.tipo.codigo)) {
      return NextResponse.json({ error: 'Solicitação TI não encontrada.' }, { status: 404 })
    }

    const payload = (solicitation.payload as any) ?? {}
    const metadata = { ...(payload.metadata ?? {}) }
    const updateData: Prisma.SolicitationUpdateInput = {}

    if (action === 'assumir') {
      updateData.assumidaPor = { connect: { id: me.id } }
      updateData.assumidaEm = new Date()
      updateData.status = solicitation.status === 'ABERTA' ? 'EM_ATENDIMENTO' : solicitation.status
      metadata.tiStatus = 'EM_ATENDIMENTO'
    } else if (action === 'prioridade') {
      const prioridade = String(body?.prioridade ?? '').toUpperCase() as SolicitationPriority
      if (!['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'].includes(prioridade)) return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 })
      updateData.prioridade = prioridade
      updateData.dataPrevista = computeTiDueDate(prioridade, solicitation.dataAbertura) ?? solicitation.dataPrevista
    } else if (action === 'status') {
      const nextStatus = String(body?.status ?? '').toUpperCase()
      if (nextStatus === 'CONCLUIDA') updateData.dataFechamento = new Date()
      if (['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO_APROVACAO', 'CONCLUIDA', 'CANCELADA'].includes(nextStatus)) {
        updateData.status = nextStatus as SolicitationStatus
      }
      metadata.tiStatus = nextStatus
    } else {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    updateData.payload = {
      ...payload,
      metadata,
    }

    const updated = await prisma.solicitation.update({ where: { id: solicitation.id }, data: updateData })
    await prisma.comment.create({ data: { id: crypto.randomUUID(), solicitationId: solicitation.id, autorId: me.id, texto: `[PAINEL_TI] Ação executada: ${action}.` } })

    return NextResponse.json({ id: updated.id, status: updated.status, prioridade: updated.prioridade, dataPrevista: updated.dataPrevista })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar chamado TI.'
    const status = message.includes('Acesso negado') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
