'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type GenericRecord = Record<string, unknown>

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(', ') : '—'
  return JSON.stringify(value)
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

function entriesFromObject(raw?: GenericRecord | null) {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw).filter(([key]) => key !== 'campos')
}

export default function PrintSolicitationPage() {
  const params = useParams<{ id: string }>()
  const solicitationId = params?.id

  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!solicitationId) return
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/solicitacoes/${solicitationId}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar dados para impressão.')
        if (!mounted) return
        setDetail(json)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Erro ao gerar a visualização de impressão.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [solicitationId])

  useEffect(() => {
    if (!detail || loading || error) return
    const timeout = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timeout)
  }, [detail, loading, error])

  const payload = (detail?.payload ?? {}) as GenericRecord
  const payloadCampos = ((payload.campos ?? {}) as GenericRecord) ?? {}
  const payloadBaseEntries = useMemo(() => entriesFromObject(payload), [payload])

  if (loading) return <div className="p-6 text-sm text-slate-600">Carregando visualização de impressão...</div>
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-slate-900 print:max-w-none print:p-4">
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <header className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold">Impressão do chamado</h1>
        <p className="text-xs text-slate-500">
          Protocolo {detail?.protocolo ?? '—'} • Tipo {detail?.tipo?.nome ?? detail?.titulo ?? '—'}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <p><strong>Número/código:</strong> {detail?.protocolo ?? '—'}</p>
        <p><strong>Status:</strong> {detail?.status ?? '—'}</p>
        <p><strong>Tipo:</strong> {detail?.tipo?.nome ?? '—'}</p>
        <p><strong>Data de abertura:</strong> {formatDateTime(detail?.dataAbertura)}</p>
        <p><strong>Data de fechamento:</strong> {formatDateTime(detail?.dataFechamento)}</p>
        <p><strong>Solicitante:</strong> {detail?.payload?.solicitante?.fullName ?? '—'}</p>
        <p><strong>Colaborador relacionado:</strong> {detail?.payload?.solicitanteManual?.fullName ?? detail?.payload?.colaboradorNome ?? '—'}</p>
        <p><strong>Centro de custo:</strong> {detail?.costCenter?.description ?? detail?.payload?.solicitante?.costCenterText ?? '—'}</p>
        <p><strong>Cargo:</strong> {detail?.payload?.solicitante?.positionName ?? detail?.payload?.campos?.cargo ?? '—'}</p>
        <p><strong>Salário:</strong> {detail?.payload?.campos?.salario ?? detail?.payload?.campos?.salarioProposto ?? '—'}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Campos específicos preenchidos</h2>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          {Object.entries(payloadCampos).length === 0 ? (
            <p className="text-slate-500">Sem campos específicos registrados.</p>
          ) : (
            Object.entries(payloadCampos).map(([key, value]) => (
              <p key={key}><strong>{key}:</strong> {formatValue(value)}</p>
            ))
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Observações e resposta de atendimento</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(detail?.comentarios ?? []).length === 0 ? (
            <li>Sem observações registradas.</li>
          ) : (
            (detail?.comentarios ?? []).map((comment: any) => (
              <li key={comment.id}>
                <strong>{comment?.autor?.fullName ?? 'Sistema'}:</strong> {comment?.texto ?? '—'}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Anexos / evidências</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(detail?.anexos ?? []).length === 0 ? (
            <li>Sem anexos.</li>
          ) : (
            (detail?.anexos ?? []).map((file: any) => (
              <li key={file.id}>{file.filename} ({file.mimeType ?? 'arquivo'})</li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Histórico relevante</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(detail?.timelines ?? []).length === 0 ? (
            <li>Sem histórico.</li>
          ) : (
            (detail?.timelines ?? []).map((timeline: any) => (
              <li key={timeline.id}>
                {formatDateTime(timeline.createdAt)} — <strong>{timeline.status}</strong>: {timeline.message ?? '—'}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Demais dados da solicitação</h2>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          {payloadBaseEntries.map(([key, value]) => (
            <p key={key}><strong>{key}:</strong> {formatValue(value)}</p>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Payload completo (auditoria)</h2>
        <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5">{JSON.stringify(payload, null, 2)}</pre>
      </section>
    </main>
  )
}