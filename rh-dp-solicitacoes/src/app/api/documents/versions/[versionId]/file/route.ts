import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import { ModuleLevel } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  })

  if (!version) {
    return NextResponse.json({ error: 'Versão do documento não encontrada.' }, { status: 404 })
  }

  const [moduleAccess, departmentLink] = await Promise.all([
    prisma.userModuleAccess.findFirst({
      where: {
        userId: me.id,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: { in: ['controle-documentos', 'meus-documentos'] } },
      },
      select: { id: true },
    }),
    prisma.userDepartment.findFirst({
      where: {
        userId: me.id,
        departmentId: version.document.ownerDepartmentId,
      },
      select: { id: true },
    }),
  ])

  const canRead =
    me.role === 'ADMIN' ||
    version.document.authorUserId === me.id ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink) ||
    Boolean(moduleAccess)

  if (!canRead) {
    return NextResponse.json({ error: 'Sem acesso ao documento.' }, { status: 403 })
  }

  const resolvedFileUrl = version.fileUrl
    ? version.fileUrl
    : (
      await prisma.documentVersion.findFirst({
        where: { documentId: version.documentId, isCurrentPublished: true, fileUrl: { not: null } },
        orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }],
        select: { fileUrl: true },
      })
    )?.fileUrl ?? null

  if (!resolvedFileUrl) {
    return NextResponse.json({ error: 'Arquivo da versão publicada não encontrado.' }, { status: 404 })
  }

  const normalized = normalizeStoredUrl(resolvedFileUrl)
  const absolutePath = path.join(process.cwd(), 'public', normalized)

  try {
    const fileBuffer = await readFile(absolutePath)
    const filename = path.basename(normalized)
    const encodedName = encodeURIComponent(filename)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo do documento não encontrado.' }, { status: 404 })
  }
}
