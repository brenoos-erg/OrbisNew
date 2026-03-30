import { requireActiveUser } from '@/lib/auth'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import DocumentHistoryClient from './DocumentHistoryClient'

export default async function DocumentHistoryPage() {
  const me = await requireActiveUser()
  const isAdmin = me.role === 'ADMIN'

  return (
    <div className="space-y-5">
      <DocumentControlTabs isAdmin={isAdmin} />
      <DocumentHistoryClient />
    </div>
  )
}