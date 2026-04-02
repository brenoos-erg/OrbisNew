import { requireActiveUser } from '@/lib/auth'
import ControlledPdfViewer from '@/components/documents/ControlledPdfViewer'

type SearchParams = {
  allowDownload?: string
  allowPrint?: string
}

export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>
  searchParams: Promise<SearchParams>
}) {
  await requireActiveUser()
  const { versionId } = await params
  const query = await searchParams

  // Flags opcionais para esconder ações por permissão (ex.: ?allowDownload=0&allowPrint=0)
  const canDownload = query.allowDownload !== '0'
  const canPrint = query.allowPrint !== '0'

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto w-full max-w-6xl">
        <ControlledPdfViewer versionId={versionId} canDownload={canDownload} canPrint={canPrint} />
      </div>
    </main>
  )
}