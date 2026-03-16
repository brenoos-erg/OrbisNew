export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'


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

  const protocoloNormalizado = protocolo?.trim() ?? ''
  const hasProtocoloFilter = protocoloNormalizado.length > 0

  if (status && !hasProtocoloFilter) where.status = status

  if (hasProtocoloFilter) {
    where.protocolo = {
      contains: protocoloNormalizado,
    }
  }

  if (solicitante) {
    where.solicitante = {
      OR: [
        { fullName: { contains: solicitante } },
        { email: { contains: solicitante } },
      ],
    }
  }

  if (text) {
    const or: any[] = [
      { titulo: { contains: text } },
      { descricao: { contains: text } },
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
    const where = buildWhereFromSearchParams(searchParams)


    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })
  const gestorAvaliadorFilter = {
      approverId: me.id,
      status: 'AGUARDANDO_AVALIACAO_GESTOR' as const,
    }


    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          buildReceivedWhereByPolicy(userAccess),
          gestorAvaliadorFilter,
        ],
      },
    ]


    const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)
    where.AND = [
      ...(where.AND ?? []),
      buildSensitiveHiringVisibilityWhere({
        userId: me.id,
        role: me.role,
        departmentIds: userDepartmentIdsForSensitive,
      }),
    ]

    where.AND = [
      ...(where.AND ?? []),
      {
        NOT: {
          AND: [
            { requiresApproval: true },
            { approvalStatus: 'PENDENTE' },
            { OR: [{ tipo: { id: 'RQ_063' } }, { tipo: { codigo: 'RQ.RH.001' } }] },
          ],
        },
      },
    ]

   const [solicitations, total] = await Promise.all([
      prisma.solicitation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dataAbertura: 'desc' },
        include: {
          tipo: { select: { codigo: true, nome: true } },
          department: { select: { name: true } },
          costCenter: { select: { description: true, externalCode: true, code: true } },
          approver: { select: { id: true, fullName: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          solicitante: { select: { id: true, fullName: true } },
          eventos: {
            where: {
              tipo: {
                in: ['FINALIZADA', 'FINALIZADA_RH', 'FINALIZADA_DP', 'FINALIZADA_TI'],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { actor: { select: { id: true, fullName: true } } },
          },
        },
      }),
      prisma.solicitation.count({ where }),
    ])

   const rows = solicitations.map((s) => {
      const finalizadorEvent = s.eventos?.[0] ?? null

      return {
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      protocolo: s.protocolo,
      createdAt: s.dataAbertura ? s.dataAbertura.toISOString() : null,
      tipo: s.tipo ? { codigo: s.tipo.codigo, nome: s.tipo.nome } : null,
      responsavelId: s.assumidaPor?.id ?? null,
      responsavel: s.assumidaPor ? { fullName: s.assumidaPor.fullName } : null,
      finalizadorId: finalizadorEvent?.actor?.id ?? null,
      finalizador: finalizadorEvent?.actor
        ? { fullName: finalizadorEvent.actor.fullName }
        : null,
      autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,
      sla: null,
      setorDestino: s.department?.name ?? formatCostCenterLabel(s.costCenter, ''),
      departamentoResponsavel: s.department?.name ?? null,
      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
      costCenterId: s.costCenterId ?? null,
      approverId: s.approver?.id ?? s.approverId ?? null,
      }
    })

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