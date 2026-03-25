import AcaoNaoConformidadeDetailClient from '@/app/dashboard/sst/nao-conformidades/[id]/acoes/[actionId]/AcaoNaoConformidadeDetailClient'

export default async function AcaoNaoConformidadeDetailPage({ params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await params
  return <AcaoNaoConformidadeDetailClient id={id} actionId={actionId} />
}