'use client'

import { useEffect, useMemo, useState } from 'react'

type AssignmentRow = {
  id: string
  status: 'PENDENTE' | 'AGUARDANDO_ASSINATURA' | 'ASSINADO' | 'RECUSADO'
  signingProvider: string | null
  signingUrl: string | null
  signedAt: string | null
  document: {
    id: string
    title: string
    pdfUrl: string
    solicitation: {
      id: string
      protocolo: string
      titulo: string
      status: string
    } | null
  }
}

const statusLabel: Record<AssignmentRow['status'], string> = {
  PENDENTE: 'Pendente',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  ASSINADO: 'Assinado',
  RECUSADO: 'Recusado',
}

export default function MeusDocumentosPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status !== 'ASSINADO').length,
    [rows],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meus-documentos')
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Erro ao carregar documentos.')
      }
      const data = (await res.json()) as AssignmentRow[]
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar documentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function requestSignature(row: AssignmentRow) {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/documents/${row.document.id}/request-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: row.id, provider: 'PROVEDOR_EXTERNO' }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Erro ao iniciar assinatura.')
      }
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao iniciar assinatura.')
    } finally {
      setBusyId(null)
    }
  }

  async function signNow(row: AssignmentRow) {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/meus-documentos/${row.id}/assinar`, {
        method: 'POST',
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Erro ao assinar documento.')
      }
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao assinar documento.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Meus documentos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Visualize e assine seus termos pendentes. Pendências atuais: {pendingCount}
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        {loading ? <p className="text-sm text-gray-600">Carregando...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !rows.length ? (
          <p className="text-sm text-gray-600">Nenhum documento disponível.</p>
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => {
            const canAsk = row.status === 'PENDENTE'
            const canSign = row.status === 'AGUARDANDO_ASSINATURA' || row.status === 'PENDENTE'

            return (
              <div key={row.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.document.title}</p>
                    <p className="text-xs text-gray-600">
                      Status: {statusLabel[row.status]}{' '}
                      {row.document.solicitation
                        ? `• Solicitação ${row.document.solicitation.protocolo}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={row.document.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Ver PDF
                    </a>
                    {canAsk ? (
                      <button
                        onClick={() => requestSignature(row)}
                        disabled={busyId === row.id}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busyId === row.id ? 'Enviando...' : 'Solicitar assinatura'}
                      </button>
                    ) : null}
                    {canSign ? (
                      <button
                        onClick={() => signNow(row)}
                        disabled={busyId === row.id}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === row.id ? 'Assinando...' : 'Assinar'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}