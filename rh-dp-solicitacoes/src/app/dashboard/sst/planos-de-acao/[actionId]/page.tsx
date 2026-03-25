import { redirect } from 'next/navigation'

export default async function LegacyPlanoAvulsoDetailPage({ params }: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await params
  redirect(`/dashboard/sgi/qualidade/planos-de-acao/${actionId}`)
}