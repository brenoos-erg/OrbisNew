import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/published" title="Documentos Publicados" fixedStatus="PUBLICADO" />
}