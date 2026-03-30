'use client'

import { useEffect, useState } from 'react'

type Props = { versionId: string }
type ViewPayload = {
  error?: string
  requiresTerm?: boolean
  term?: { id: string; title: string; content: string }
  url?: string
  document?: { code: string; title: string; revisionNumber: number }
}

export default function VisualizacaoDocumentoClient({ versionId }: Props) {
  const [data, setData] = useState<ViewPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/documents/versions/${versionId}/view`, { method: 'POST', cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as ViewPayload | null
      setData(payload)
      setLoading(false)
    }
    void load()
  }, [versionId])

  if (loading) return <div className="p-6 text-sm text-slate-600">Carregando visualização…</div>
  if (!data || data.error) return <div className="p-6 text-sm text-rose-700">{data?.error ?? 'Não foi possível abrir o documento.'}</div>
  if (data.requiresTerm) return <div className="p-6 text-sm text-amber-800">Aceite o termo de responsabilidade na listagem de documentos antes de visualizar.</div>

  return (
    <div className="min-h-screen bg-slate-100 p-3">
      <div className="mx-auto max-w-6xl space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">CÓPIA NÃO CONTROLADA</p>
          <p>Documento emitido como cópia não controlada. Verifique a versão vigente no sistema.</p>
          {data.document ? <p className="mt-1 text-amber-800">{data.document.code} · {data.document.title} · REV {data.document.revisionNumber}</p> : null}
        </div>
        {data.url ? (
          <div>
            <iframe
              className="h-[calc(100vh-120px)] w-full rounded-lg border border-slate-200 bg-white"
              src={`${data.url}#toolbar=0&navpanes=0`}
              title="Visualização controlada do documento"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}