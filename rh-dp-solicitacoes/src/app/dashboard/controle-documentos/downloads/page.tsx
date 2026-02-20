import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/downloads" title="Controle de Download" />
}