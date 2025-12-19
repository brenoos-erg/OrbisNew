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
   for (const module of CORE_MODULES) {
    // Evita criar duplicados com variações da key (maiúsculas/underscores etc.)
    const existing = await prisma.module.findFirst({
      where: { key: { equals: module.key, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existing) {
      await prisma.module.update({
        where: { id: existing.id },
        data: { key: module.key, name: module.name },
      })
    } else {
      await prisma.module.create({ data: module })
    }
  }
}

function normalizeModulesAndLinks(
  modules: { id: string; key: string; name: string }[],
  links: { departmentId: string; moduleId: string }[],
) {
  const byKey = new Map<
    string,
    { canonical: { id: string; key: string; name: string }; allIds: Set<string> }
  >()

  modules.forEach((mod) => {
    const slugKey = mod.key.toLowerCase()
    const entry = byKey.get(slugKey)

    if (!entry) {
      byKey.set(slugKey, {
        canonical: { ...mod, key: slugKey },
        allIds: new Set([mod.id]),
      })
      return
    }

    entry.allIds.add(mod.id)

    // preferir o módulo que já está com key slugificada como canonical
    if (mod.key.toLowerCase() === mod.key) {
      entry.canonical = { ...mod, key: slugKey }
    }
  })

  const normalizedModules = Array.from(byKey.values())
    .map(({ canonical }) => canonical)
    .sort((a, b) => a.name.localeCompare(b.name))

  const normalizedLinks: { departmentId: string; moduleId: string }[] = []
  links.forEach((link) => {
    const normalized = Array.from(byKey.values()).find((entry) => entry.allIds.has(link.moduleId))
    if (!normalized) return

    const alreadyInserted = normalizedLinks.some(
      (l) => l.departmentId === link.departmentId && l.moduleId === normalized.canonical.id,
    )

    if (!alreadyInserted) {
      normalizedLinks.push({ departmentId: link.departmentId, moduleId: normalized.canonical.id })
    }
  })

  return { modules: normalizedModules, links: normalizedLinks }
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

   const normalized = normalizeModulesAndLinks(modules, links)

    return NextResponse.json({ departments, modules: normalized.modules, links: normalized.links })
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
