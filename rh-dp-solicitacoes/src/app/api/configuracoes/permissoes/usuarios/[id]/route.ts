export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/configuracoes/permissoes/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ModuleLevel } from '@prisma/client'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
     const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', 'NIVEL_3')
    const userId = (await params).id
    const body = await req.json()
    const moduleKey = String(body.moduleKey || '').trim()
    const level = (body.level || null) as ModuleLevel | null

    if (!userId || !moduleKey) {
      return NextResponse.json(
        { error: 'userId e moduleKey são obrigatórios.' },
        { status: 400 },
      )
    }

    const module = await prisma.module.findUnique({
      where: { key: moduleKey },
      select: { id: true },
    })

    if (!module) {
      return NextResponse.json(
        { error: 'Módulo não encontrado.' },
        { status: 404 },
      )
    }

    const existing = await prisma.userModuleAccess.findFirst({
      where: { userId, moduleId: module.id },
    })

    if (!level) {
      // remover acesso
      if (existing) {
        await prisma.userModuleAccess.delete({ where: { id: existing.id } })
      }
    } else if (existing) {
      // atualizar nível
      await prisma.userModuleAccess.update({
        where: { id: existing.id },
        data: { level },
      })
    } else {
      // criar acesso
      await prisma.userModuleAccess.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          moduleId: module.id,
          level,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(
      'PATCH /api/configuracoes/permissoes/usuarios/[id] error',
      e,
    )
    return NextResponse.json(
      { error: 'Erro ao salvar nível do usuário.' },
      { status: 500 },
    )
  }
}
