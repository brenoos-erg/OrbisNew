// src/app/api/configuracoes/permissoes/departamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'

export const revalidate = 300

const CORE_MODULES = [
  { key: 'solicitacoes', name: 'Solicitações' },
  { key: 'configuracoes', name: 'Configurações' },
  { key: 'gestao-de-frotas', name: 'Gestão de Frotas' },
]

async function ensureCoreModules() {
  await Promise.all(
    CORE_MODULES.map((module) =>
      prisma.module.upsert({
        where: { key: module.key },
        update: { name: module.name },
        create: module,
      }),
    ),
  )
}


// GET: todos departamentos + módulos + links
export async function GET() {
  const me = await requireActiveUser()
  await assertUserMinLevel(me.id, 'configuracoes', 'NIVEL_3')
  await ensureCoreModules()
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true },
  })

  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, key: true, name: true },
  })

  const links = await prisma.departmentModule.findMany({
    select: { departmentId: true, moduleId: true },
  })

  return NextResponse.json({ departments, modules, links })
}

// POST: habilitar / desabilitar módulo para um departamento
export async function POST(req: NextRequest) {
  try {
     const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', 'NIVEL_3')
    const body = await req.json()
    const departmentId = String(body.departmentId || '').trim()
    const moduleId = String(body.moduleId || '').trim()
    const enabled = !!body.enabled

    if (!departmentId || !moduleId) {
      return NextResponse.json(
        { error: 'departmentId e moduleId são obrigatórios.' },
        { status: 400 },
      )
    }

    const existing = await prisma.departmentModule.findFirst({
      where: { departmentId, moduleId },
    })

    if (enabled) {
      if (!existing) {
        await prisma.departmentModule.create({
          data: {
            id: crypto.randomUUID(),
            departmentId,
            moduleId,
          },
        })
      }
    } else {
      if (existing) {
        await prisma.departmentModule.delete({
          where: { id: existing.id },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(
      'POST /api/configuracoes/permissoes/departamentos error',
      e,
    )
    return NextResponse.json(
      { error: 'Erro ao salvar permissões de departamento.' },
      { status: 500 },
    )
  }
}
