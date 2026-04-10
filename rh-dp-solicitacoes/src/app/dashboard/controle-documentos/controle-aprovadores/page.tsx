import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import ApproversControlClient from './ApproversControlClient'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')
  const userIsAdmin = isAdmin(appUser)
  const [canAccessApproval, canAccessQuality] = await Promise.all([
    canAccessApprovalDocuments(appUser.id, appUser.role),
    canAccessQualityReviewDocuments(appUser.id, appUser.role),
  ])

  if (!userIsAdmin) {
    redirect('/dashboard/controle-documentos/publicados')
  }

  return (
    <div className="space-y-4">
      <DocumentControlTabs
        isAdmin={userIsAdmin}
        canAccessApprovalDocuments={canAccessApproval}
        canAccessQualityReviewDocuments={canAccessQuality}
      />
      <ApproversControlClient />
    </div>
  )
}