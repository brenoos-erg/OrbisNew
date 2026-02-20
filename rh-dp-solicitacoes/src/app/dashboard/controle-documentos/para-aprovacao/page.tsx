import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/in-approval" title="Documentos Para Aprovação" fixedStatus="AG_APROVACAO" />
}