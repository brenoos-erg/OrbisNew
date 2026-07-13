import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasDocumentPermission, getDocumentContextByVersionId } from '@/lib/documents/documentRoleAccess'
import { buildContentDispositionHeader } from '@/lib/documents/documentDownloadFilename'
import { resolvePrivateDocumentPublishedPath, resolvePublicDocumentPath } from '@/lib/documents/documentStorage'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  let me
  try { me = await requireActiveUser() } catch { return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 }) }
  const { versionId } = await params
  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, include: { document: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })
  if (version.status !== 'PUBLICADO' || version.operationalUseBlocked || !version.isCurrentPublished) return NextResponse.json({ error: 'Documento publicado não disponível para uso operacional.' }, { status: 403 })
  if (!(await hasDocumentPermission(me.id, 'CAN_VIEW_PUBLISHED', await getDocumentContextByVersionId(versionId)))) return NextResponse.json({ error: 'Você não possui acesso ao documento publicado.' }, { status: 403 })
  let absolutePath: string | null = null
  try {
    if (version.publishedStorageKey) absolutePath = (await resolvePrivateDocumentPublishedPath(version.publishedStorageKey)).absolutePath
    else if (version.publishedFileUrl) {
      const legacy = await resolvePublicDocumentPath(version.publishedFileUrl)
      if (legacy.exists) absolutePath = legacy.absolutePath
    }
  } catch { return NextResponse.json({ error: 'Arquivo publicado não encontrado.' }, { status: 404 }) }
  if (!absolutePath) return NextResponse.json({ error: 'Arquivo publicado não encontrado.' }, { status: 404 })
  const buffer = await fs.readFile(absolutePath).catch(() => null)
  if (!buffer) return NextResponse.json({ error: 'Arquivo publicado não encontrado.' }, { status: 404 })
  const actualSize = BigInt(buffer.byteLength)
  const actualSha256 = createHash('sha256').update(buffer).digest('hex')
  if ((version.publishedSizeBytes !== null && version.publishedSizeBytes !== actualSize) || (version.publishedSha256 && version.publishedSha256 !== actualSha256)) {
    await prisma.documentAuditLog.create({ data: { documentId: version.documentId, versionId, userId: me.id, action: 'PUBLISHED_FILE_INTEGRITY_FAILED', metadata: { published: true, expectedSize: version.publishedSizeBytes?.toString() ?? null, actualSize: actualSize.toString(), expectedSha256: version.publishedSha256, actualSha256 } } })
    return NextResponse.json({ error: 'Arquivo publicado falhou na verificação de integridade.' }, { status: 409 })
  }
  const filename = version.publishedOriginalName || `${version.document.code}-REV${String(version.revisionNumber).padStart(2, '0')}${path.extname(absolutePath) || '.pdf'}`
  const disposition = req.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'
  await prisma.documentAuditLog.create({ data: { documentId: version.documentId, versionId, userId: me.id, action: disposition === 'inline' ? 'VIEW' : 'DOWNLOAD', metadata: { published: true, filename, sizeBytes: buffer.byteLength, sha256: actualSha256 } } })
  const contentDisposition = buildContentDispositionHeader(filename).replace(/^attachment/, disposition)
  return new NextResponse(buffer, { headers: { 'Content-Type': version.publishedMimeType || 'application/pdf', 'Content-Disposition': contentDisposition, 'Cache-Control': 'private, no-store' } })
}
