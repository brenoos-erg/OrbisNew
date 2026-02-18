import AcaoNaoConformidadeDetailClient from './AcaoNaoConformidadeDetailClient'

export default async function AcaoNaoConformidadeDetailPage({
  params,
}: {
  params: Promise<{ id: string; actionId: string }>
}) {
  const { id, actionId } = await params
  return <AcaoNaoConformidadeDetailClient id={id} actionId={actionId} />
}