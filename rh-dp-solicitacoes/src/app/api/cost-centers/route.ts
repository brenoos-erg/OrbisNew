export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const url = new URL(req.url)

  // 🔎 Filtros
  const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim()

  // 🧭 Paginação — aceita vários nomes
  const pageParam =
    url.searchParams.get('page') ??
    url.searchParams.get('pagina') ??
    url.searchParams.get('pageIndex') ??
    '1'

  const sizeParam =
    url.searchParams.get('pageSize') ??
    url.searchParams.get('linhas') ??
    url.searchParams.get('limit') ??
    '10'

  const page = Math.max(parseInt(pageParam, 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(sizeParam, 10) || 10, 1), 200)

  const where: Prisma.CostCenterWhereInput | undefined = q
    ? {
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { code: { contains: q } },
          { externalCode: { contains: q } },
          { abbreviation: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { managementType: { contains: q, mode: 'insensitive' } },
          { groupName: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined

  const [total, rows] = await Promise.all([
    prisma.costCenter.count({ where }),
    prisma.costCenter.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        description: true,
        code: true,
        externalCode: true,
        abbreviation: true,
        area: true,
        managementType: true,
        groupName: true,
        status: true,
        updatedAt: true,
      },
    }),
  ])

  // 🧾 Sempre devolve { items, total }
  return NextResponse.json({ items: rows, total })
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const {
    description,
    code,
    externalCode,
    abbreviation,
    area,
    managementType,
    groupName,
    status,
    notes,
  } = body || {}

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
  }

  const normalizedStatus =
    status === 'INATIVO' || status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

  const created = await prisma.costCenter.create({
    data: {
      description: description.trim(),
      code: code?.trim() ?? null,
      externalCode: externalCode?.trim() ?? null,
      abbreviation: abbreviation?.trim() ?? null,
      area: area?.trim() ?? null,
      managementType: managementType?.trim() ?? null,
      groupName: groupName?.trim() ?? null,
      status: normalizedStatus,
      observations: notes?.trim() ?? null,
    },
    select: { id: true, description: true },
  })

  return NextResponse.json({ ok: true, row: created }, { status: 201 })
}
