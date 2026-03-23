import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import ApproversControlClient from './ApproversControlClient'

export default function Page() {
  return (
    <div className="space-y-4">
      <DocumentControlTabs />
      <ApproversControlClient />
    </div>
  )
}