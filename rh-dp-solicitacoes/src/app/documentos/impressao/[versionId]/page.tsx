import VisualizacaoDocumentoClient from '@/app/dashboard/controle-documentos/visualizacao/[versionId]/visualizacao-documento-client'
import { requireActiveUser } from '@/lib/auth'

type Props = {
  params: Promise<{ versionId: string }>
}

export default async function ImpressaoDocumentoPage({ params }: Props) {
  await requireActiveUser()
  const { versionId } = await params
  return <VisualizacaoDocumentoClient versionId={versionId} initialIntent="print" />
}