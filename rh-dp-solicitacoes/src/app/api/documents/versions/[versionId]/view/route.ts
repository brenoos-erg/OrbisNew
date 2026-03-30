import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { id: true, documentId: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  await registerDocumentAuditLog({
    action: 'VIEW',
    documentId: version.documentId,
    versionId: version.id,
    userId: me.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}