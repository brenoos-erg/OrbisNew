import VisualizacaoDocumentoClient from '@/app/dashboard/controle-documentos/visualizacao/[versionId]/visualizacao-documento-client'

type Props = {
  params: Promise<{ versionId: string }>
}

export default async function ImpressaoDocumentoPage({ params }: Props) {
  const { versionId } = await params
  return <VisualizacaoDocumentoClient versionId={versionId} initialIntent="print" />
}