import AcaoPlanoAvulsoDetailClient from './AcaoPlanoAvulsoDetailClient'

export default async function AcaoPlanoAvulsoDetailPage({ params }: { params: Promise<{ planId: string; actionId: string }> }) {
  const { planId, actionId } = await params
  return <AcaoPlanoAvulsoDetailClient planId={planId} actionId={actionId} />
}
