import { redirect } from 'next/navigation'

export default async function LegacyAcaoNaoConformidadeDetailPage({ params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await params
  redirect(`/dashboard/sgi/qualidade/nao-conformidades/${id}/acoes/${actionId}`)
}