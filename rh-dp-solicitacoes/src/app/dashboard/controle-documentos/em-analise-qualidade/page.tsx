import DocumentsGrid from '@/components/documents/DocumentsGrid'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'

export default function Page() {
  return (
    <div className="space-y-4">
      <DocumentControlTabs />
      <DocumentsGrid endpoint="/api/documents/in-quality" title="Documentos em Revisão da Qualidade" fixedStatus="EM_ANALISE_QUALIDADE" approvalStage={3} />
    </div>
  )
}