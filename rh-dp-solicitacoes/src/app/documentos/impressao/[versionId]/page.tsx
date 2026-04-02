import { requireActiveUser } from '@/lib/auth'

import ImpressaoDocumentoClient from './impressao-documento-client'

type Props = {
  params: Promise<{ versionId: string }>
}

export default async function ImpressaoDocumentoPage({ params }: Props) {
  await requireActiveUser()
  const { versionId } = await params

  return <ImpressaoDocumentoClient versionId={versionId} />
}