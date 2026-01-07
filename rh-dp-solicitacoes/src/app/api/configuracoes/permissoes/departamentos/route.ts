// src/app/api/configuracoes/permissoes/departamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'

export const dynamic = 'force-dynamic'

const CORE_MODULES = [
  { key: 'solicitacoes', name: 'Solicitações' },
  { key: 'configuracoes', name: 'Configurações' },
  { key: 'gestao-de-frotas', name: 'Gestão de Frotas' },
  { key: 'direito-de-recusa', name: 'Direito de Recusa' },
  { key: 'controle-equipamentos-ti', name: 'Controle de Equipamentos TI' },
]

async function ensureCoreModules() {
  for (const module of CORE_MODULES) {
    // Evita criar duplicados com variações da key (maiúsculas/underscores etc.)
    const existing = await prisma.module.findFirst({
      where: { key: { equals: module.key, mode: 'insensitive' } },
      select: { id: true, key: true },
    })

    if (existing) {
      // Se existir mas estiver com key diferente em caixa (ex.: "Solicitacoes" vs "solicitacoes"),
      // atualiza para a canonical
      if (existing.key !== module.key) {
        await prisma.module.update({
          where: { id: existing.id },
          data: { key: module.key, name: module.name },
        })
      }
      continue
    }

    await prisma.module.create({ data: module })
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

  const normalized = normalizeModulesAndLinks(modules, links)

  return NextResponse.json({
    departments,
    modules: normalized.modules,
    links: normalized.links,
  })
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
