import { Download } from 'lucide-react'

import ControlledPdfViewer from '@/components/documents/ControlledPdfViewer'
import { requireActiveUser } from '@/lib/auth'
import { requireQualityDocumentManager } from '@/lib/documents/documentManagementAccess'

type SearchParams = {
  allowDownload?: string
  allowPrint?: string
  intent?: string
}

export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>
  searchParams: Promise<SearchParams>
}) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const query = await searchParams
  const qualityAccess = await requireQualityDocumentManager(me.id)

  // Flags opcionais para esconder ações por permissão (ex.: ?allowDownload=0&allowPrint=0)
  const canDownload = query.allowDownload !== '0'
  const canPrint = query.allowPrint !== '0'
  const initialIntent = query.intent === 'print' ? 'print' : 'view'

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto w-full max-w-6xl space-y-3">
        {qualityAccess.canManage ? (
          <div className="flex justify-end">
            <a
              href={`/api/documents/versions/${encodeURIComponent(versionId)}/original`}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-100"
            >
              <Download size={16} /> Baixar documento original
            </a>
          </div>
        ) : null}

        <ControlledPdfViewer
          versionId={versionId}
          initialIntent={initialIntent}
          canDownload={canDownload}
          canPrint={canPrint}
        />
      </div>
    </main>
  )
}
