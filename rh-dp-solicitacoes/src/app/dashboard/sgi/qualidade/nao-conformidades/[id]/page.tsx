import NaoConformidadeDetailClient from '@/app/dashboard/sst/nao-conformidades/[id]/NaoConformidadeDetailClient'

export default async function NaoConformidadeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const resolvedSearchParams = await searchParams
  return <NaoConformidadeDetailClient id={(await params).id} initialSection={resolvedSearchParams.section} />
}