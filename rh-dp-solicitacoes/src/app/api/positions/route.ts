// src/app/api/positions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET: lista de cargos
export async function GET() {
  const rows = await prisma.position.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      departmentId: true,
      baseSalary: true,
      workLocation: true,
      workHours: true,
    },
  })

  return NextResponse.json(rows)
}

// POST: cria um novo cargo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body.name ?? '').trim()
    const description = (body.description ?? '') || null
    const departmentId = (body.departmentId ?? '') || null
    const baseSalary = body.baseSalary ?? null
    const workLocation = (body.workLocation ?? '') || null
    const workHours = (body.workHours ?? '') || null
    const requirements = (body.requirements ?? '') || null
    const activities = (body.activities ?? '') || null

    if (!name) {
      return NextResponse.json(
        { error: 'Nome do cargo é obrigatório.' },
        { status: 400 },
      )
    }

    const created = await prisma.position.create({
      data: {
        name,
        description,
        departmentId,
        baseSalary,
        workLocation,
        workHours,
        requirements,
        activities,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/positions error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao criar cargo.' },
      { status: 500 },
    )
  }
}
