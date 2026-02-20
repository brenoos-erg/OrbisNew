import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/in-review" title="Documentos Em Revisão" fixedStatus="EM_REVISAO" />
}