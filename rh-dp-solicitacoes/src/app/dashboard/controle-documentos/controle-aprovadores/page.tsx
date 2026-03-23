import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import ApproversControlClient from './ApproversControlClient'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  const isAdmin = appUser?.role === 'ADMIN'

  if (!isAdmin) {
    redirect('/dashboard/controle-documentos/publicados')
  }

  return (
    <div className="space-y-4">
      <DocumentControlTabs isAdmin={isAdmin} />
      <ApproversControlClient />
    </div>
  )
}