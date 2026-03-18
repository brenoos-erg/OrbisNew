import PlanoAvulsoDetailClient from './PlanoAvulsoDetailClient'

export default async function PlanoAvulsoDetailPage({ params }: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await params
  return <PlanoAvulsoDetailClient actionId={actionId} />
}