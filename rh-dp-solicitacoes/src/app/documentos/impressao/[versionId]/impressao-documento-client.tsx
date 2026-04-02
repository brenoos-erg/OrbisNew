'use client'

import { useEffect, useState } from 'react'

type Props = { versionId: string }

type PrintPayload = {
  error?: string
  requiresTerm?: boolean
  url?: string
}

export default function ImpressaoDocumentoClient({ versionId }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/documents/versions/${versionId}/controlled`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ intent: 'print' }),
        })

        const payload = (await res.json().catch(() => null)) as PrintPayload | null

        if (!res.ok) {
          setError(payload?.error ?? 'Não foi possível preparar o PDF final para impressão.')
          return
        }

        if (payload?.requiresTerm) {
          setError('Aceite o termo de responsabilidade na listagem de documentos antes de imprimir.')
          return
        }

        if (!payload?.url) {
          setError('Não foi possível localizar o PDF final para impressão.')
          return
        }

        window.location.replace(`${payload.url}#toolbar=0&navpanes=0`)
      } catch {
        setError('Falha de conexão ao preparar o PDF final para impressão.')
      }
    }

    void load()
  }, [versionId])

  if (error) {
    return <div className="p-6 text-sm text-rose-700">{error}</div>
  }

  return <div className="p-6 text-sm text-slate-600">Preparando PDF final para impressão…</div>
}