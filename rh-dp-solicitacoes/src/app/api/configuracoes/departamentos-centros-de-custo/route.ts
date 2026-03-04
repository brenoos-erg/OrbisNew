export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

export async function GET() {
  try {
    const me = await requireActiveUser()
    if (me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const [departments, costCenters] = await Promise.all([
      prisma.department.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      prisma.costCenter.findMany({
        orderBy: { description: 'asc' },
        select: { id: true, code: true, description: true, departmentId: true },
      }),
    ])

    return NextResponse.json({ departments, costCenters })
  } catch (err) {
    console.error('GET /api/configuracoes/departamentos-centros-de-custo', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const me = await requireActiveUser()
    if (me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const departmentId = typeof body?.departmentId === 'string' ? body.departmentId : ''
    const costCenterIds = Array.isArray(body?.costCenterIds)
      ? body.costCenterIds.filter((id: unknown): id is string => typeof id === 'string')
      : []

    if (!departmentId) {
      return NextResponse.json({ error: 'departmentId é obrigatório.' }, { status: 400 })
    }

    const exists = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.costCenter.updateMany({
        where: { departmentId },
        data: { departmentId: null },
      })

      if (costCenterIds.length > 0) {
        await tx.costCenter.updateMany({
          where: { id: { in: costCenterIds } },
          data: { departmentId },
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/configuracoes/departamentos-centros-de-custo', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}