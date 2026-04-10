import { requireActiveUser } from '@/lib/auth'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import DocumentHistoryClient from './DocumentHistoryClient'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'

export default async function DocumentHistoryPage() {
  const me = await requireActiveUser()
  const userIsAdmin = isAdmin(me)
  const [canAccessApproval, canAccessQuality] = await Promise.all([
    canAccessApprovalDocuments(me.id, me.role),
    canAccessQualityReviewDocuments(me.id, me.role),
  ])

  return (
    <div className="space-y-5">
      <DocumentControlTabs
        isAdmin={userIsAdmin}
        canAccessApprovalDocuments={canAccessApproval}
        canAccessQualityReviewDocuments={canAccessQuality}
      />
      <DocumentHistoryClient />
    </div>
  )
}