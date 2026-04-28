import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'
import { redirect } from 'next/navigation'
import DocumentNotificationsPanel from './DocumentNotificationsPanel'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const userIsAdmin = isAdmin(appUser)
  if (!userIsAdmin) redirect('/dashboard/controle-documentos/publicados?forbidden=document-notifications')

  const [canAccessApproval, canAccessQuality] = await Promise.all([
    canAccessApprovalDocuments(appUser.id, appUser.role),
    canAccessQualityReviewDocuments(appUser.id, appUser.role),
  ])

  return (
    <div className="space-y-4">
      <DocumentControlTabs
        isAdmin={userIsAdmin}
        canAccessApprovalDocuments={canAccessApproval}
        canAccessQualityReviewDocuments={canAccessQuality}
      />
      <DocumentNotificationsPanel canEdit />
    </div>
  )
}
