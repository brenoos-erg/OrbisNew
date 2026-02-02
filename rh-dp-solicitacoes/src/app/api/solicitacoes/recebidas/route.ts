export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  resolveNadaConstaSetorByDepartment,
} from '@/lib/solicitationTypes'

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
    const where = buildWhereFromSearchParams(searchParams)

    const ccIds = new Set<string>()
    const deptIds = new Set<string>()

    if (me.costCenterId) {
      ccIds.add(me.costCenterId)
    }

    if (me.departmentId) {
      deptIds.add(me.departmentId)
    }

    const links = await prisma.userCostCenter.findMany({
      where: { userId: me.id },
      select: { costCenterId: true },
    })

    for (const link of links) {
      ccIds.add(link.costCenterId)
    }

    const departmentLinks = await prisma.userDepartment.findMany({
      where: { userId: me.id },
      select: {
        departmentId: true,
        department: { select: { code: true, name: true } },
      },
    })

    for (const link of departmentLinks) {
      deptIds.add(link.departmentId)
    }

    const setorKeys = new Set<string>()
    const primarySetor = resolveNadaConstaSetorByDepartment(me.department)
    if (primarySetor) {
      setorKeys.add(primarySetor)
    }

    for (const link of departmentLinks) {
      const setor = resolveNadaConstaSetorByDepartment(link.department)
      if (setor) {
        setorKeys.add(setor)
      }
    }

    const setorFilters =
      setorKeys.size > 0
        ? [
            {
              solicitacaoSetores: {
                some: { setor: { in: [...setorKeys] } },
              },
            },
          ]
        : []

    const isDpUser =
      me.department?.code === '08' ||
      departmentLinks.some((link) => link.department?.code === '08')

    const dpDepartmentId =
      me.department?.code === '08'
        ? me.departmentId
        : departmentLinks.find((link) => link.department?.code === '08')
            ?.departmentId

    const dpFilters =
      isDpUser && dpDepartmentId
        ? [{ costCenterId: null, departmentId: dpDepartmentId }]
        : []

    if (where.costCenterId) {
      const receivedFilters = ccIds.has(where.costCenterId)
        ? [{ costCenterId: where.costCenterId }]
        : []

      if (receivedFilters.length === 0 && setorFilters.length === 0) {
        where.id = '__never__' as any
      } else {
        where.AND = [
          ...(where.AND ?? []),
          { OR: [...receivedFilters, ...setorFilters] },
        ]
      }
    } else {
      const receivedFilters = [
        ...(ccIds.size > 0 ? [{ costCenterId: { in: [...ccIds] } }] : []),
        ...(deptIds.size > 0 ? [{ departmentId: { in: [...deptIds] } }] : []),
        ...dpFilters,
      ]

      if (receivedFilters.length === 0 && setorFilters.length === 0) {
        where.id = '__never__' as any
      } else {
        where.AND = [
          ...(where.AND ?? []),
          { OR: [...receivedFilters, ...setorFilters] },
        ]
      }
    }

    where.AND = [
      ...(where.AND ?? []),
      {
        NOT: {
          AND: [
            { requiresApproval: true },
            { approvalStatus: 'PENDENTE' },
            { tipo: { nome: 'RQ_063 - Solicitação de Pessoal' } },
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
    return NextResponse.json(
      { error: 'Erro ao buscar solicitações recebidas.' },
      { status: 500 },
    )
  }
}
