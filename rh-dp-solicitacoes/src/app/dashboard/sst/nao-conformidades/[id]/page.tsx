import { redirect } from 'next/navigation'

export default async function LegacyNaoConformidadeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const section = resolvedSearchParams.section ? `?section=${encodeURIComponent(resolvedSearchParams.section)}` : ''
  redirect(`/dashboard/sgi/qualidade/nao-conformidades/${id}${section}`)
}