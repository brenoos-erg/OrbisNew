import DocumentsGrid from '@/components/documents/DocumentsGrid'

export default function Page() {
  return <DocumentsGrid endpoint="/api/documents/in-quality" title="Docs. Em Análise Qualidade" fixedStatus="EM_ANALISE_QUALIDADE" />
}