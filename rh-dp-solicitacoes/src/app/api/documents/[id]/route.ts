import { ModuleLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'

export const DELETE = withModuleLevel(
  MODULE_KEYS.CONTROLE_DOCUMENTOS,
  ModuleLevel.NIVEL_3,
  async (_req, ctx) => {
    const { id } = await ctx.params

    const exists = await prisma.isoDocument.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    await prisma.isoDocument.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  },
)