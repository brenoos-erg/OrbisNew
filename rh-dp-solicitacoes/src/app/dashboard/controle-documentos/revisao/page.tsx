import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/in-review" title="Documentos em Processo de Revisão" />
}