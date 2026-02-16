import NaoConformidadeDetailClient from './NaoConformidadeDetailClient'

export default async function NaoConformidadeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <NaoConformidadeDetailClient id={(await params).id} />
}