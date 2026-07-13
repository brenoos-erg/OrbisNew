import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveSourceFileAccess } from '@/lib/documents/documentSourceAccess'
import { buildContentDispositionHeader } from '@/lib/documents/documentDownloadFilename'
import { resolvePrivateDocumentSourcePath, resolvePublicDocumentPath, resolveSafeOriginalFilename } from '@/lib/documents/documentStorage'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8',
}

function sourceAuditAction(disposition: 'inline' | 'attachment') {
  return disposition === 'attachment' ? 'SOURCE_FILE_DOWNLOADED' : 'SOURCE_FILE_VIEWED'
}

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  let me
  try {
    me = await requireActiveUser()
  } catch {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 })
  }

  const { versionId } = await params
  const disposition = req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const purpose = req.nextUrl.searchParams.get('purpose')?.trim() || null

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { select: { id: true, code: true, title: true } } },
  })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  const access = await resolveSourceFileAccess(me.id, versionId, disposition)
  if (!access.allowed) return NextResponse.json({ error: 'Você não possui acesso ao arquivo original.' }, { status: 403 })

  let absolutePath: string | null = null
  let storageReference = version.sourceStorageKey ?? null
  try {
    if (version.sourceStorageKey) {
      absolutePath = (await resolvePrivateDocumentSourcePath(version.sourceStorageKey)).absolutePath
    } else if (version.sourceFileUrl) {
      // Fallback temporário para referências legadas em public/uploads/documents durante a migração.
      const legacy = await resolvePublicDocumentPath(version.sourceFileUrl)
      if (!legacy.exists) return NextResponse.json({ error: 'Arquivo original não encontrado.' }, { status: 404 })
      absolutePath = legacy.absolutePath
      storageReference = legacy.resolvedFileUrl
      console.warn('[documents.source] legacy-public-source-fallback-used', { versionId, documentId: version.documentId })
    }
  } catch {
    return NextResponse.json({ error: 'Arquivo original não encontrado.' }, { status: 404 })
  }

  if (!absolutePath) return NextResponse.json({ error: 'Arquivo original não encontrado.' }, { status: 404 })
  const buffer = await fs.readFile(absolutePath).catch(() => null)
  if (!buffer) return NextResponse.json({ error: 'Arquivo original não encontrado.' }, { status: 404 })

  const actualSize = BigInt(buffer.byteLength)
  const actualSha256 = createHash('sha256').update(buffer).digest('hex')
  const expectedSize = version.sourceSizeBytes ?? null
  const expectedSha256 = version.sourceSha256 ?? null
  if ((expectedSize !== null && expectedSize !== actualSize) || (expectedSha256 && expectedSha256 !== actualSha256)) {
    await prisma.documentAuditLog.create({
      data: {
        action: 'SOURCE_FILE_INTEGRITY_FAILED',
        documentId: version.documentId,
        versionId: version.id,
        userId: me.id,
        ip: requestIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: { expectedSize: expectedSize?.toString() ?? null, actualSize: actualSize.toString(), expectedSha256, actualSha256 },
      },
    })
    return NextResponse.json({ error: 'Arquivo original falhou na verificação de integridade.' }, { status: 409 })
  }

  const filename = version.sourceOriginalName || resolveSafeOriginalFilename({ code: version.document.code, revisionNumber: version.revisionNumber, storageKey: storageReference })
  const contentType = version.sourceMimeType || MIME_BY_EXTENSION[path.extname(filename).toLowerCase()] || 'application/octet-stream'
  const auditAction = sourceAuditAction(disposition)

  await prisma.documentAuditLog.create({
    data: {
      action: auditAction,
      documentId: version.documentId,
      versionId: version.id,
      userId: me.id,
      ip: requestIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: {
        fileName: filename,
        mimeType: contentType,
        sizeBytes: actualSize.toString(),
        sha256: actualSha256,
        role: access.role ?? null,
        permissionSource: access.permissionSource ?? null,
        scopeType: access.scopeType ?? null,
        assignmentId: access.assignmentId ?? null,
        purpose,
      },
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition === 'attachment' ? buildContentDispositionHeader(filename) : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, max-age=0, no-cache',
      'X-Document-File-Kind': 'SOURCE',
    },
  })
}
