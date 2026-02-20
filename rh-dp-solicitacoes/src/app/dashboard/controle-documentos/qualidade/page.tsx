import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/in-quality" title="Documentos para Análise da Qualidade" />
}