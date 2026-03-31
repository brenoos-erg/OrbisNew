import { requireActiveUser } from '@/lib/auth'
import VisualizacaoDocumentoClient from './visualizacao-documento-client'

export default async function VisualizacaoDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>
  searchParams: Promise<{ intent?: string }>
}) {
  await requireActiveUser()
  const { versionId } = await params
  const { intent } = await searchParams

  return <VisualizacaoDocumentoClient versionId={versionId} initialIntent={intent === 'print' ? 'print' : 'view'} />
}