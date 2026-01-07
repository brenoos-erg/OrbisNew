import { NextResponse } from 'next/server'
import { Action, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import {
  TI_EQUIPMENT_CATEGORIES,
  TI_EQUIPMENT_STATUSES,
  type TiEquipmentCategory,
  type TiEquipmentStatus,
} from '@/lib/tiEquipment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAllowedCategories(userId: string, action: Action) {
  const checks = await Promise.all(
    TI_EQUIPMENT_CATEGORIES.map(async (category) => {
      const allowed = await canFeature(
        userId,
        MODULE_KEYS.EQUIPAMENTOS_TI,
        category.featureKey,
        action,
      )
      return allowed ? category.value : null
    }),
  )

  return checks.filter(Boolean) as TiEquipmentCategory[]
}

function buildSearchWhere(search?: string | null): Prisma.TiEquipmentWhereInput | undefined {
  if (!search) return undefined
  const term = search.trim()
  if (!term) return undefined

  const OR: Prisma.TiEquipmentWhereInput[] = [
    { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
    { patrimonio: { contains: term, mode: Prisma.QueryMode.insensitive } },
    { serialNumber: { contains: term, mode: Prisma.QueryMode.insensitive } },
    { user: { is: { fullName: { contains: term, mode: Prisma.QueryMode.insensitive } } } },
    { user: { is: { email: { contains: term, mode: Prisma.QueryMode.insensitive } } } },
  ]

  return { OR }
}

function mapRow(row: any) {
  return {
    ...row,
    value: row.value ? Number(row.value) : null,
    costCenterSnapshot: row.costCenterSnapshot
      ? {
          id: row.costCenterSnapshot.id,
          description: row.costCenterSnapshot.description,
          externalCode: row.costCenterSnapshot.externalCode,
          code: row.costCenterSnapshot.code,
        }
      : null,
  }
}

export async function GET(req: Request) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const allowedCategories = await getAllowedCategories(appUser.id, Action.VIEW)

  if (allowedCategories.length === 0) {
    return NextResponse.json({ error: 'Acesso negado aos equipamentos TI.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '10', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = Number.isFinite(pageSizeParam)
    ? Math.min(50, Math.max(5, pageSizeParam))
    : 10

  if (category && !TI_EQUIPMENT_CATEGORIES.some((cat) => cat.value === category)) {
    return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
  }

  if (status && !TI_EQUIPMENT_STATUSES.includes(status as TiEquipmentStatus)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  if (category && !allowedCategories.includes(category as TiEquipmentCategory)) {
    return NextResponse.json({ error: 'Acesso negado à categoria solicitada.' }, { status: 403 })
  }

  const categoryValue = category ? (category as TiEquipmentCategory) : null
  const statusValue = status ? (status as TiEquipmentStatus) : null

  const baseWhere: Prisma.TiEquipmentWhereInput = {
    ...(categoryValue ? { category: categoryValue } : { category: { in: allowedCategories } }),
    ...(buildSearchWhere(search) ?? {}),
  }

  const listWhere: Prisma.TiEquipmentWhereInput = {
    ...baseWhere,
    ...(statusValue ? { status: statusValue } : {}),
  }

  const [rows, total, grouped] = await Promise.all([
    prisma.tiEquipment.findMany({
      where: listWhere,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        costCenterSnapshot: {
          select: { id: true, description: true, externalCode: true, code: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tiEquipment.count({ where: listWhere }),
    prisma.tiEquipment.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    }),
  ])

  const counts = grouped.reduce(
    (acc, row) => {
      const statusKey = row.status
      const count = row._count._all
      acc.total += count
      if (statusKey === 'IN_STOCK') acc.inStock = count
      if (statusKey === 'ASSIGNED') acc.assigned = count
      if (statusKey === 'MAINTENANCE') acc.maintenance = count
      if (statusKey === 'RETIRED') acc.retired = count
      return acc
    },
    { total: 0, inStock: 0, assigned: 0, maintenance: 0, retired: 0 },
  )

  return NextResponse.json({
    items: rows.map(mapRow),
    total,
    counts,
  })
}

export async function POST(req: Request) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      name,
      patrimonio,
      userId,
      value,
      serialNumber,
      category,
      status = 'IN_STOCK',
      observations,
    } = body ?? {}

    if (!name || !patrimonio || !userId) {
      return NextResponse.json(
        { error: 'Nome, patrimônio e usuário são obrigatórios.' },
        { status: 400 },
      )
    }

    if (!category || !TI_EQUIPMENT_CATEGORIES.some((cat) => cat.value === category)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    if (status && !TI_EQUIPMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    const canCreate = await canFeature(
      appUser.id,
      MODULE_KEYS.EQUIPAMENTOS_TI,
      TI_EQUIPMENT_CATEGORIES.find((cat) => cat.value === category)!.featureKey,
      Action.CREATE,
    )

    if (!canCreate) {
      return NextResponse.json({ error: 'Sem permissão para criar equipamentos.' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        fullName: true,
        email: true,
        costCenterId: true,
        costCenter: { select: { id: true, description: true, externalCode: true, code: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const created = await prisma.tiEquipment.create({
      data: {
        name: String(name).trim(),
        patrimonio: String(patrimonio).trim(),
        userId: user.id,
        value: value === null || value === undefined || value === '' ? null : new Prisma.Decimal(value),
        serialNumber: serialNumber ? String(serialNumber).trim() : null,
        category: category as any, // se seu Prisma for enum, pode trocar por `category as Prisma.TiEquipmentCategory`
        status: status as any,     // idem
        observations: observations ? String(observations).trim() : null,
        costCenterIdSnapshot: user.costCenterId ?? null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        costCenterSnapshot: {
          select: { id: true, description: true, externalCode: true, code: true },
        },
      },
    })

    const warning = user.costCenterId
      ? null
      : 'Usuário sem centro de custo; o registro foi salvo sem centro de custo.'

    return NextResponse.json({ item: mapRow(created), warning }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um equipamento com o mesmo patrimônio ou série.' },
        { status: 409 },
      )
    }

    console.error('Erro ao criar equipamento', error)
    return NextResponse.json({ error: 'Erro ao criar equipamento.' }, { status: 500 })
  }
}
