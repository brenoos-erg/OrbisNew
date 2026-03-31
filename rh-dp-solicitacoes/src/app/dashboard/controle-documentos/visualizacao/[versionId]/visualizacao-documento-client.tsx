'use client'

import { useEffect, useState } from 'react'

type Props = { versionId: string; initialIntent: 'view' | 'print' }
type ViewPayload = {
  error?: string
  requiresTerm?: boolean
  term?: { id: string; title: string; content: string }
  isPdf?: boolean
  fileExtension?: string
  conversionError?: string | null
  url?: string
  downloadUrl?: string
  document?: { code: string; title: string; revisionNumber: number }
}
export default function VisualizacaoDocumentoClient({ versionId, initialIntent }: Props) {
  const [data, setData] = useState<ViewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [frameReady, setFrameReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setRequestError(null)
      try {
        const endpoint = initialIntent === 'print'
          ? `/api/documents/versions/${versionId}/print`
          : `/api/documents/versions/${versionId}/view`
        const res = await fetch(endpoint, { method: 'POST', cache: 'no-store' })
        const payload = (await res.json().catch(() => null)) as ViewPayload | null
        if (!payload) {
          setRequestError('Não foi possível interpretar a resposta do servidor.')
          setData(null)
        } else {
          setData(payload)
        }
      } catch {
        setRequestError('Erro de conexão ao buscar o documento.')
        setData(null)
      }
      setLoading(false)
    }
     void load()
  }, [versionId, initialIntent])

  useEffect(() => {
    if (!frameReady || initialIntent !== 'print') return
    const timer = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timer)
  }, [frameReady, initialIntent])

  if (loading) return <div className="p-6 text-sm text-slate-600">Carregando visualização…</div>
  if (requestError) return <div className="p-6 text-sm text-rose-700">{requestError}</div>
  if (!data || data.error) return <div className="p-6 text-sm text-rose-700">{data?.error ?? 'Não foi possível abrir o documento.'}</div>
  if (data.requiresTerm) return <div className="p-6 text-sm text-amber-800">Aceite o termo de responsabilidade na listagem de documentos antes de visualizar.</div>

  const extensionLabel = data?.fileExtension ? data.fileExtension.replace('.', '').toUpperCase() : 'não-PDF'

  return (
    <div className="min-h-screen bg-slate-100 p-3">
      <div className="mx-auto max-w-6xl space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">CÓPIA NÃO CONTROLADA</p>
          <p>Documento emitido como cópia não controlada. Verifique a versão vigente no sistema.</p>
          {data.document ? <p className="mt-1 text-amber-800">{data.document.code} · {data.document.title} · REV {data.document.revisionNumber}</p> : null}
        </div>
        {data.isPdf && data.url ? (
          <div>
            <iframe
              className="h-[calc(100vh-120px)] w-full rounded-lg border border-slate-200 bg-white"
              src={`${data.url}#toolbar=0&navpanes=0`}
              title="Visualização controlada do documento"
              onLoad={() => setFrameReady(true)}
            />
          </div>
        ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Este documento está em formato {extensionLabel}.</p>
            <p className="mt-2">{data.conversionError ?? 'A visualização interna suporta apenas arquivos PDF. Faça o download do arquivo original para abrir no aplicativo correspondente.'}</p>
            {data.downloadUrl ? (
              <a
                className="mt-4 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                href={data.downloadUrl}
              >
                Baixar arquivo original
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}