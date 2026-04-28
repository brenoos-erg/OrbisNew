import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'
import { canAccessApprovalDocuments, canAccessQualityReviewDocuments, isAdmin } from '@/lib/documentApprovalControl'
import { redirect } from 'next/navigation'
import DocumentNotificationsPanel from './DocumentNotificationsPanel'
import { getUserModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { ModuleLevel } from '@prisma/client'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const level = await getUserModuleLevel(appUser.id, MODULE_KEYS.CONTROLE_DOCUMENTOS)
  if (level !== ModuleLevel.NIVEL_2 && level !== ModuleLevel.NIVEL_3) {
    redirect('/dashboard/controle-documentos/publicados')
  }

  const userIsAdmin = isAdmin(appUser)
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
      <DocumentNotificationsPanel canEdit={level === ModuleLevel.NIVEL_3} />
    </div>
  )
}
