'use client'

import { useEffect, useState } from 'react'

type Props = { versionId: string; initialIntent: 'view' }
type ViewPayload = {
  error?: string
  requiresTerm?: boolean
  term?: { id: string; title: string; content: string }
  isPdf?: boolean
  fileExtension?: string
  url?: string
  downloadUrl?: string
  printUrl?: string
  document?: { code: string; title: string; revisionNumber: number }
}

export default function VisualizacaoDocumentoClient({ versionId, initialIntent }: Props) {
  const [data, setData] = useState<ViewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setRequestError(null)
      try {
        const res = await fetch(`/api/documents/versions/${versionId}/controlled`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ intent: initialIntent }),
        })
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

  if (loading) return <div className="p-6 text-sm text-slate-600">Carregando visualização…</div>
  if (requestError) return <div className="p-6 text-sm text-rose-700">{requestError}</div>
  if (!data || data.error) return <div className="p-6 text-sm text-rose-700">{data?.error ?? 'Não foi possível abrir o documento.'}</div>
  if (data.requiresTerm) return <div className="p-6 text-sm text-amber-800">Aceite o termo de responsabilidade na listagem de documentos antes de visualizar.</div>

  if (data.isPdf && data.url) {
    return (
      <div className="min-h-screen bg-slate-100 p-3">
        <div className="mx-auto max-w-6xl">
          <iframe
            className="h-[calc(100vh-120px)] w-full rounded-lg border border-slate-200 bg-white"
            src={`${data.url}#toolbar=0&navpanes=0`}
            title="Visualização controlada do documento"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 text-sm text-rose-700">
      Não foi possível abrir o PDF final com marca d’água deste documento.
      {data.fileExtension ? (
        <span className="block text-xs text-rose-600">Formato informado: {data.fileExtension.replace('.', '').toUpperCase()}.</span>
      ) : null}
      <div className="mt-3">
        <a className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" href="/dashboard/controle-documentos/publicados">
          Voltar para a listagem
        </a>
      </div>
    </div>
  )
}