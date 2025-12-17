// src/app/api/permissoes/departamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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



/**
 * GET /api/permissoes/departamentos
 * Retorna:
 * {
 *   departments: [{ id, code, name }],
 *   modules:     [{ id, key, name }],
 *   links:       [{ departmentId, moduleId }]
 * }
 */
export async function GET(_req: NextRequest) {
  try {
    const me = await requireActiveUser()
    // 🔐 Só NIVEL_3 no módulo "configuracoes" pode mexer nisso
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)
    await ensureCoreModules()

    const [departments, modules, links] = await Promise.all([
      prisma.department.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.module.findMany({
        select: { id: true, key: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.departmentModule.findMany({
        select: { departmentId: true, moduleId: true },
      }),
    ])

    return NextResponse.json({ departments, modules, links })
  } catch (e: any) {
    console.error('GET /api/permissoes/departamentos error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Erro ao carregar permissões de departamentos.' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/permissoes/departamentos
 * body: { departmentId: string, moduleId: string, enabled: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const body = await req.json().catch(() => ({} as any))
    const { departmentId, moduleId, enabled } = body as {
      departmentId?: string
      moduleId?: string
      enabled?: boolean
    }

    if (!departmentId || !moduleId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'departmentId, moduleId e enabled são obrigatórios.' },
        { status: 400 },
      )
    }

    if (enabled) {
      // cria se não existir
      const exists = await prisma.departmentModule.findFirst({
        where: { departmentId, moduleId },
      })

      if (!exists) {
        await prisma.departmentModule.create({
          data: { departmentId, moduleId },
        })
      }
    } else {
      // remove o vínculo
      await prisma.departmentModule.deleteMany({
        where: { departmentId, moduleId },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/permissoes/departamentos error', e)

    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Erro ao salvar permissão do departamento.' },
      { status: 500 },
    )
  }
}
