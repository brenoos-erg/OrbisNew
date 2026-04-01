import { requireActiveUser } from '@/lib/auth'
import VisualizacaoDocumentoClient from './visualizacao-documento-client'

export default async function VisualizacaoDocumentoPage({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  await requireActiveUser()
  const { versionId } = await params

  return <VisualizacaoDocumentoClient versionId={versionId} initialIntent="view" />
}