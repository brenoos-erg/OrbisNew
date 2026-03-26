import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
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

  const canDownload =
    me.role === 'ADMIN' ||
    version.document.authorUserId === me.id ||
    version.document.ownerDepartmentId === me.departmentId ||
    Boolean(departmentLink) ||
    Boolean(moduleAccess)

  if (!canDownload) {
    return NextResponse.json({ error: 'Sem acesso ao documento.' }, { status: 403 })
  }

  await prisma.documentDownloadLog.create({
    data: {
      documentId: version.documentId,
      versionId,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    },
  })

  return NextResponse.json({ url: version.fileUrl })
}