import DocumentsGrid from '@/components/documents/DocumentsGrid'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'
import { redirect } from 'next/navigation'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')
  const userIsAdmin = isAdmin(appUser)
  const [canAccessApproval, canAccessQuality] = await Promise.all([
    canAccessApprovalDocuments(appUser.id, appUser.role),
    canAccessQualityReviewDocuments(appUser.id, appUser.role),
  ])
  if (!canAccessApproval) redirect('/dashboard/controle-documentos/publicados')

  return (
    <div className="space-y-4">
      <DocumentControlTabs
        isAdmin={userIsAdmin}
        canAccessApprovalDocuments={canAccessApproval}
        canAccessQualityReviewDocuments={canAccessQuality}
      />
      <DocumentsGrid endpoint="/api/documents/in-approval" title="Documentos para Aprovação" fixedStatus="AG_APROVACAO" approvalStage={2} />
    </div>
  )
}