import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'
import { redirect } from 'next/navigation'
import DocumentNotificationsPanel from './DocumentNotificationsPanel'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const userIsAdmin = isAdmin(appUser)
  if (!userIsAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Acesso negado. Apenas administradores podem acessar a Central de Notificações de Documentos.
      </div>
    )
  }

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
