import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { moduleKey, actions } = await req.json()
  const mod = await prisma.module.findUnique({ where: { key: moduleKey } })
  if (!mod) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })

  const grant = await prisma.accessGroupGrant.upsert({
    where: { groupId_moduleId: { groupId: params.id, moduleId: mod.id } },
    create: { groupId: params.id, moduleId: mod.id, actions: actions || [] },
    update: { actions: actions || [] },
  })
  return NextResponse.json(grant)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const moduleKey = new URL(req.url).searchParams.get('moduleKey') || ''
  const mod = await prisma.module.findUnique({ where: { key: moduleKey } })
  if (!mod) return NextResponse.json({ ok: true })
  await prisma.accessGroupGrant.delete({ where: { groupId_moduleId: { groupId: params.id, moduleId: mod.id } } })
  return NextResponse.json({ ok: true })
}
