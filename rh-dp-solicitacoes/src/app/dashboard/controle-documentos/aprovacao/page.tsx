import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/for-approval" title="Documentos Para Aprovação" />
}