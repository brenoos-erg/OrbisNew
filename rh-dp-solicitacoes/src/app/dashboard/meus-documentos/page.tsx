'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type AssignmentRow = {
  id: string
  status: 'PENDENTE' | 'AGUARDANDO_ASSINATURA' | 'ASSINADO' | 'RECUSADO'
  signingProvider: string | null
  signingUrl: string | null
  auditTrailUrl?: string | null
  signedAt: string | null
  document: {
    id: string
    title: string
    pdfUrl: string
    signedPdfUrl?: string | null
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
  const searchParams = useSearchParams()
  const [modalRow, setModalRow] = useState<AssignmentRow | null>(null)
  const [vistoriaObservacoes, setVistoriaObservacoes] = useState('')

  const pendingCount = useMemo(() => rows.filter((row) => row.status !== 'ASSINADO').length, [rows])

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

  async function continueToSign(row: AssignmentRow) {
    setBusyId(row.id)
    setError(null)
    try {
      const obs = vistoriaObservacoes.trim()
      if (obs.length < 5) {
        throw new Error('Preencha as observações de vistoria (mínimo de 5 caracteres).')
      }

   const res = await fetch(`/api/documents/${row.document.id}/request-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: row.id, vistoriaObservacoes: obs }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Erro ao iniciar assinatura.')
      }

      const payload = await res.json().catch(() => ({}))
      const signingUrl = payload?.signingUrl || payload?.assignment?.signingUrl || null
      if (!signingUrl) {
        throw new Error('Link de assinatura ainda não disponível.')
      }

      setModalRow(null)
      setVistoriaObservacoes('')
      window.location.href = signingUrl
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao assinar documento.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">

      {searchParams.get('signed') === '1' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Documento assinado com sucesso.
        </div>
      ) : null}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Meus documentos</h1>
        <p className="mt-1 text-sm text-gray-600">Visualize e assine seus termos pendentes. Pendências atuais: {pendingCount}</p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        {loading ? <p className="text-sm text-gray-600">Carregando...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !rows.length ? <p className="text-sm text-gray-600">Nenhum documento disponível.</p> : null}

        <div className="space-y-3">
          {rows.map((row) => {
            const canSign = row.status === 'AGUARDANDO_ASSINATURA' || row.status === 'PENDENTE'

            return (
              <div key={row.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.document.title}</p>
                    <p className="text-xs text-gray-600">
                      Status: {statusLabel[row.status]} {row.document.solicitation ? `• Solicitação ${row.document.solicitation.protocolo}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {row.status === 'ASSINADO' && row.document.signedPdfUrl ? (
                      <a href={row.document.signedPdfUrl} target="_blank" rel="noreferrer" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                        Ver PDF assinado
                      </a>
                    ) : null}
                    <a href={row.document.pdfUrl} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Ver PDF
                    </a>
                    {canSign ? (
                      <button onClick={() => { setModalRow(row); setVistoriaObservacoes('') }} disabled={busyId === row.id} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {busyId === row.id ? 'Abrindo...' : 'Assinar'}
                      </button>
                    ) : null}
                    {row.auditTrailUrl ? (
                      <a href={row.auditTrailUrl} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        Ver trilha
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modalRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Observações de vistoria</h2>
            <p className="mt-1 text-sm text-gray-600">Informe as observações para regenerar o termo antes da assinatura no DocuSign.</p>
            <textarea
              value={vistoriaObservacoes}
              onChange={(e) => setVistoriaObservacoes(e.target.value)}
              className="mt-4 min-h-32 w-full rounded-lg border border-gray-300 p-3 text-sm outline-none ring-blue-300 focus:ring"
              placeholder="Ex.: Equipamento entregue com pequena marca na tampa, funcionando normalmente."
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModalRow(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => continueToSign(modalRow)} disabled={busyId === modalRow.id} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {busyId === modalRow.id ? 'Redirecionando...' : 'Continuar para assinatura'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}