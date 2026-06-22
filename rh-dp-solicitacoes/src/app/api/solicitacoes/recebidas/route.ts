export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  buildReceivedWhereByPolicy,
  buildSolicitationVisibilityContext,
} from '@/lib/solicitationAccessPolicy'

function buildWhereFromSearchParams(searchParams: URLSearchParams) {
  const where: any = {}

  const dateStart = searchParams.get('dateStart')
  const dateEnd = searchParams.get('dateEnd')
  const centerId = searchParams.get('centerId')
  const costCenterId = searchParams.get('costCenterId') ?? centerId
  const departmentId = searchParams.get('departmentId')
  const tipoId = searchParams.get('tipoId')
  const protocolo = searchParams.get('protocolo')
  const solicitante = searchParams.get('solicitante')
  const status = searchParams.get('status')
  const text = searchParams.get('text')

  if (dateStart || dateEnd) {
    where.dataAbertura = {}
    if (dateStart) {
      where.dataAbertura.gte = new Date(dateStart + 'T00:00:00')
    }
    if (dateEnd) {
      const end = new Date(dateEnd + 'T23:59:59')
      where.dataAbertura.lte = end
    }
  }

  if (departmentId) where.departmentId = departmentId
  if (costCenterId) where.costCenterId = costCenterId
  if (tipoId) where.tipoId = tipoId
  if (status) where.status = status

  if (protocolo) {
    where.protocolo = {
      contains: protocolo,
      mode: 'insensitive',
    }
  }

  if (solicitante) {
    where.solicitante = {
      OR: [
        { fullName: { contains: solicitante, mode: 'insensitive' } },
        { email: { contains: solicitante, mode: 'insensitive' } },
      ],
    }
  }

  if (text) {
    const or: any[] = [
      { titulo: { contains: text, mode: 'insensitive' } },
      { descricao: { contains: text, mode: 'insensitive' } },
    ]
    if (where.OR) {
      where.OR = [...where.OR, ...or]
    } else {
      where.OR = or
    }
  }

  return where
}


export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { searchParams } = new URL(req.url)
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    )
    const pageSize =
      Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10

    const skip = (page - 1) * pageSize
    const visibilityContext = await buildSolicitationVisibilityContext(me)
    const where = buildReceivedWhereByPolicy(
      visibilityContext,
      buildWhereFromSearchParams(searchParams),
      { excludePendingRq063: true },
    )

    const [solicitations, total] = await Promise.all([
      prisma.solicitation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dataAbertura: 'desc' },
        include: {
          tipo: { select: { nome: true } },
          department: { select: { name: true } },
          costCenter: { select: { description: true, externalCode: true, code: true } },
          approver: { select: { id: true, fullName: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          solicitante: { select: { id: true, fullName: true } },
        },
      }),
      prisma.solicitation.count({ where }),
    ])

    const rows = solicitations.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      protocolo: s.protocolo,
      createdAt: s.dataAbertura ? s.dataAbertura.toISOString() : null,
      tipo: s.tipo ? { nome: s.tipo.nome } : null,
      responsavelId: s.assumidaPor?.id ?? null,
      responsavel: s.assumidaPor ? { fullName: s.assumidaPor.fullName } : null,
      autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,
      sla: null,
      setorDestino:
        formatCostCenterLabel(s.costCenter, '') || (s.department?.name ?? null),
      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
      costCenterId: s.costCenterId ?? null,
    }))

    return NextResponse.json({ rows, total })
  } catch (err) {
    console.error('GET /api/solicitacoes/recebidas error', err)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2021' &&
      err.meta?.table === 'public.SolicitacaoSetor'
    ) {
      return NextResponse.json(
        {
          error:
            'Erro de configuração: tabela SolicitacaoSetor ausente. Execute as migrations do Prisma.',
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'Erro ao buscar solicitações recebidas.' },
      { status: 500 },
    )
  }
}
