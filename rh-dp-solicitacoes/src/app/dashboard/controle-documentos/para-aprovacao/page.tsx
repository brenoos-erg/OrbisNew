import DocumentsGrid from '@/components/documents/DocumentsGrid'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  const isAdmin = appUser?.role === 'ADMIN'

  return (
    <div className="space-y-4">
      <DocumentControlTabs isAdmin={isAdmin} />
      <DocumentsGrid endpoint="/api/documents/in-approval" title="Documentos para Aprovação" fixedStatus="AG_APROVACAO" approvalStage={2} />
    </div>
  )
}