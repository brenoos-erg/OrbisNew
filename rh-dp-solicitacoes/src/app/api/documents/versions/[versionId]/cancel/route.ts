import { DocumentVersionStatus, ModuleLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'

export const PATCH = withModuleLevel(
  MODULE_KEYS.CONTROLE_DOCUMENTOS,
  ModuleLevel.NIVEL_3,
  async (_req, ctx) => {
    const { versionId } = await ctx.params

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        status: true,
        documentId: true,
      },
    })

    if (!version) {
      return NextResponse.json({ error: 'Versão do documento não encontrada.' }, { status: 404 })
    }

    if (version.status === DocumentVersionStatus.CANCELADO) {
      return NextResponse.json({ error: 'Documento já está cancelado.' }, { status: 409 })
    }

    await prisma.documentVersion.update({
      where: { id: versionId },
      data: {
        status: DocumentVersionStatus.CANCELADO,
        isCurrentPublished: false,
      },
    })

    return NextResponse.json({ ok: true, status: DocumentVersionStatus.CANCELADO })
  },
)