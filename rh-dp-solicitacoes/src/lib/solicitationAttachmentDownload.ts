import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildSolicitationVisibilityContext } from '@/lib/solicitationAccessPolicy'
import { canUserViewSolicitationByFallback } from '@/lib/solicitationVisibility'
import { getInlineMimeType, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'

type AuthenticatedUser = { id: string; role?: string | null }

export async function downloadSolicitationAttachment({
  user,
  solicitationId,
  attachmentId,
}: {
  user: AuthenticatedUser
  solicitationId: string
  attachmentId: string
}) {
  const [solicitation, attachment] = await Promise.all([
    prisma.solicitation.findUnique({ where: { id: solicitationId }, include: { tipo: true, solicitacaoSetores: true } }),
    prisma.attachment.findFirst({ where: { id: attachmentId, solicitationId } }),
  ])

  if (!solicitation || !attachment) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })

  const visibilityContext = await buildSolicitationVisibilityContext(user)
  const visibility = canUserViewSolicitationByFallback(visibilityContext, solicitation)
  if (!visibility.canView) return NextResponse.json({ error: 'Você não possui permissão para baixar este anexo.' }, { status: 403 })

  const resolved = await resolveExistingAttachmentPath(attachment.url)
  if (!resolved) return NextResponse.json({ error: 'Arquivo não encontrado no servidor. Reenvie o anexo ou acione o suporte.' }, { status: 404 })

  try {
    const fileBuffer = await readFile(resolved.absolutePath)
    const mimeType = getInlineMimeType(attachment.mimeType, attachment.filename)
    const encodedName = encodeURIComponent(attachment.filename)
    const disposition = mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment'
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado no servidor. Reenvie o anexo ou acione o suporte.' }, { status: 404 })
  }
}
