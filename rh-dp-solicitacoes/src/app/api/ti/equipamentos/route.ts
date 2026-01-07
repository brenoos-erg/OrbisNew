import { NextResponse } from 'next/server'
import { ModuleLevel, Prisma, TiEquipmentCategory, TiEquipmentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withModuleLevel } from '@/lib/access'

const CATEGORY_VALUES = Object.values(TiEquipmentCategory)
const STATUS_VALUES = Object.values(TiEquipmentStatus)

type QueryParams = {
  category?: string | null
  status?: string | null
  search?: string | null
  page?: number
  pageSize?: number
}

function parseQuery(searchParams: URLSearchParams): Required<QueryParams> {
  const category = searchParams.get('category')
  const normalizedCategory = CATEGORY_VALUES.includes((category || '') as any)
    ? (category as TiEquipmentCategory)
    : null

  const status = searchParams.get('status')
  const normalizedStatus = STATUS_VALUES.includes((status || '') as any)
    ? (status as TiEquipmentStatus)
    : null

  const search = searchParams.get('search')?.trim() || null

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get('pageSize') || '10', 10) || 10, 1),
    200,
  )

  return { category: normalizedCategory, status: normalizedStatus, search, page, pageSize }
}

function buildSearchWhere(search: string | null): Prisma.TiEquipmentWhereInput | undefined {
  if (!search) return undefined

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { patrimonio: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      {
        user: { fullName: { contains: search, mode: 'insensitive' } },
      },
      {
        costCenterSnapshot: {
          OR: [
            { externalCode: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    ],
  }
}

export const GET = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_1,
  async (req: Request) => {
    const url = new URL(req.url)
    const { category, status, search, page, pageSize } = parseQuery(url.searchParams)

    const parsedPage = Math.max(page || 1, 1)
    const parsedSize = Math.min(Math.max(pageSize || 10, 1), 200)

    const filters: Prisma.TiEquipmentWhereInput = {
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...buildSearchWhere(search),
    }

    const baseFilterForCounts: Prisma.TiEquipmentWhereInput = {
      ...(category ? { category } : {}),
      ...buildSearchWhere(search),
    }

    const [items, total, inStock, assigned, maintenance, retired] =
      await prisma.$transaction([
        prisma.tiEquipment.findMany({
          where: filters,
          orderBy: { updatedAt: 'desc' },
          skip: (parsedPage - 1) * parsedSize,
          take: parsedSize,
          select: {
            id: true,
            name: true,
            patrimonio: true,
            serialNumber: true,
            value: true,
            category: true,
            status: true,
            observations: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: { id: true, fullName: true, email: true, costCenterId: true },
            },
            costCenterSnapshot: {
              select: {
                id: true,
                description: true,
                externalCode: true,
                code: true,
              },
            },
          },
        }),
        prisma.tiEquipment.count({ where: filters }),
        prisma.tiEquipment.count({
          where: { ...baseFilterForCounts, status: TiEquipmentStatus.IN_STOCK },
        }),
        prisma.tiEquipment.count({
          where: { ...baseFilterForCounts, status: TiEquipmentStatus.ASSIGNED },
        }),
        prisma.tiEquipment.count({
          where: { ...baseFilterForCounts, status: TiEquipmentStatus.MAINTENANCE },
        }),
        prisma.tiEquipment.count({
          where: { ...baseFilterForCounts, status: TiEquipmentStatus.RETIRED },
        }),
      ])

    return NextResponse.json({
      items,
      total,
      counts: {
        total: inStock + assigned + maintenance + retired,
        inStock,
        assigned,
        maintenance,
        retired,
      },
    })
  },
)

export const POST = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_2,
  async (req: Request) => {
    const body = await req.json().catch(() => ({} as any))
    const {
      name,
      patrimonio,
      userId,
      value,
      serialNumber,
      category,
      status,
      observations,
    } = body || {}

    if (!name?.trim() || !patrimonio?.trim() || !userId?.trim()) {
      return NextResponse.json(
        { error: 'Nome, patrimônio e usuário são obrigatórios.' },
        { status: 400 },
      )
    }

    if (!CATEGORY_VALUES.includes(category)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    if (status && !STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, costCenterId: true, fullName: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const normalizedValue =
      value === null || typeof value === 'undefined' || value === ''
        ? null
        : new Prisma.Decimal(value)

    try {
      const created = await prisma.tiEquipment.create({
        data: {
          name: name.trim(),
          patrimonio: patrimonio.trim(),
          userId: user.id,
          value: normalizedValue,
          costCenterIdSnapshot: user.costCenterId,
          serialNumber: serialNumber?.trim() || null,
          category,
          status: status || TiEquipmentStatus.IN_STOCK,
          observations: observations?.trim() || null,
        },
      })

      return NextResponse.json({
        ok: true,
        row: created,
        warning: !user.costCenterId
          ? 'Usuário sem centro de custo. Equipamento salvo com centro de custo vazio.'
          : undefined,
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = (err.meta?.target ?? []) as string[]
        if (target.includes('TiEquipment_patrimonio_key')) {
          return NextResponse.json(
            { error: 'Patrimônio já existe.' },
            { status: 409 },
          )
        }
        if (target.includes('TiEquipment_serialNumber_key')) {
          return NextResponse.json(
            { error: 'Número de série já cadastrado.' },
            { status: 409 },
          )
        }
      }

      console.error('POST /api/ti/equipamentos error', err)
      return NextResponse.json(
        { error: 'Erro ao criar equipamento.' },
        { status: 500 },
      )
    }
  },
)