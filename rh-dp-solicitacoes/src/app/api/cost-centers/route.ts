// src/app/api/configuracoes/centros-de-custo/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET: lista (com busca opcional e paginação opcional)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const take = Math.min(Number(searchParams.get('take') || 100), 200)
  const skip = Math.max(Number(searchParams.get('skip') || 0), 0)

  const where = q
    ? {
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { externalCode: { contains: q, mode: 'insensitive' } },
          { abbreviation: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { managementType: { contains: q, mode: 'insensitive' } },
          { groupName: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  const [rows, total] = await Promise.all([
    prisma.costCenter.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
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
        notes: true,
        updatedAt: true,
      },
    }),
    prisma.costCenter.count({ where }),
  ])

  return NextResponse.json({ rows, total })
}

// POST: cria
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

  const created = await prisma.costCenter.create({
    data: {
      description: description.trim(),
      code: code?.trim() || null,
      externalCode: externalCode?.trim() || null,
      abbreviation: abbreviation?.trim() || null,
      area: area?.trim() || null,
      managementType: managementType?.trim() || null,
      groupName: groupName?.trim() || null,
      status: status === 'INATIVO' ? 'INATIVO' : 'ATIVADO',
      notes: notes?.trim() || null,
    },
    select: { id: true, description: true },
  })

  return NextResponse.json({ ok: true, row: created })
}
