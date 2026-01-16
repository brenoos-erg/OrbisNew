export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


type Params = { params: { id: string } }

/**
 * Lista os módulos vinculados ao Centro de Custo
 */
export async function GET(_req: Request, { params }: Params) {
  const rows = await prisma.costCenterModule.findMany({
    where: { costCenterId: params.id },
    include: { module: { select: { id: true, key: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows.map((r) => r.module))
}

/**
 * Vincula um módulo ao Centro de Custo
 * body: { moduleKey: string }
 */
export async function POST(req: Request, { params }: Params) {
  const { moduleKey } = (await req.json()) as { moduleKey?: string }
  if (!moduleKey?.trim()) {
    return NextResponse.json({ error: 'moduleKey é obrigatório' }, { status: 400 })
  }

  const mod = await prisma.module.findUnique({ where: { key: moduleKey } })
  if (!mod) {
    return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })
  }

  // Índice único gerado pelo @@unique([costCenterId, moduleId])
  await prisma.costCenterModule.upsert({
    where: { costCenterId_moduleId: { costCenterId: params.id, moduleId: mod.id } },
    update: {},
    create: { costCenterId: params.id, moduleId: mod.id },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

/**
 * Remove o vínculo de módulo do Centro de Custo
 * query: ?moduleKey=...
 */
export async function DELETE(req: Request, { params }: Params) {
  const moduleKey = new URL(req.url).searchParams.get('moduleKey') ?? ''
  if (!moduleKey.trim()) return NextResponse.json({ error: 'moduleKey é obrigatório' }, { status: 400 })

  const mod = await prisma.module.findUnique({ where: { key: moduleKey } })
  if (!mod) return NextResponse.json({ ok: true }) // nada pra deletar

  await prisma.costCenterModule.delete({
    where: { costCenterId_moduleId: { costCenterId: params.id, moduleId: mod.id } },
  })

  return NextResponse.json({ ok: true })
}
