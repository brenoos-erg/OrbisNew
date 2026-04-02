import { requireActiveUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ versionId: string }>
}

export default async function ImpressaoDocumentoPage({ params }: Props) {
  await requireActiveUser()
  const { versionId } = await params

  redirect(`/documents/view/${encodeURIComponent(versionId)}?intent=print`)
}