import { type NextRequest } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { downloadSolicitationAttachment } from '@/lib/solicitationAttachmentDownload'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; anexoId: string }> }) {
  const me = await requireActiveUser()
  const { id, anexoId } = await params
  return downloadSolicitationAttachment({ user: me, solicitationId: id, attachmentId: anexoId })
}
