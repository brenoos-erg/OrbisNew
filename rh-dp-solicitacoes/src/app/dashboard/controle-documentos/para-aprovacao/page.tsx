import DocumentsGrid from '@/components/documents/DocumentsGrid'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'

export default function Page() {
  return (
    <div className="space-y-4">
      <DocumentControlTabs />
      <DocumentsGrid endpoint="/api/documents/in-approval" title="Documentos para Aprovação" fixedStatus="AG_APROVACAO" approvalStage={2} />
    </div>
  )
}