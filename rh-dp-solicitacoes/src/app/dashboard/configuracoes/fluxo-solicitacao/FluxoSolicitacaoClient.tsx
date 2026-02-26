'use client'

import { FormEvent, useState } from 'react'

type FluxoResponse = {
  solicitacao: {
    id: string
    protocolo: string
    tipo: string
    solicitante: string
    status: string
  }
  etapaAtual: {
    id: string
    nome: string
    tipo: 'DEPARTMENT' | 'APPROVERS'
    departamento: string | null
    responsavelAtual: string | null
    status: string
  }
  aprovacoes: Array<{ aprovador: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }>
  historico: Array<{
    etapa: string
    tipo: 'DEPARTMENT' | 'APPROVERS'
    status: 'FINALIZADO' | 'EM ANDAMENTO' | 'PENDENTE'
    dataInicio: string | null
    dataFim: string | null
  }>
}

const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

function statusClass(status: string) {
  if (status.includes('FINALIZADO') || status.includes('APPROVED')) return 'bg-green-100 text-green-700'
  if (status.includes('ANDAMENTO') || status.includes('APPROV') || status.includes('EM ')) return 'bg-blue-100 text-blue-700'
  if (status.includes('PENDENTE') || status.includes('PENDING')) return 'bg-amber-100 text-amber-700'
  if (status.includes('REJECTED') || status.includes('REPROV')) return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR')
}

export default function FluxoSolicitacaoClient() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FluxoResponse | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/solicitacoes/fluxo/${encodeURIComponent(query.trim())}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 404) {
          setResult(null)
          setError('Solicitação não encontrada.')
          return
        }
        throw new Error('Não foi possível carregar o fluxo.')
      }

      const data = (await response.json()) as FluxoResponse
      setResult(data)
    } catch (err: any) {
      setResult(null)
      setError(err?.message ?? 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Visualizador de Fluxo da Solicitação</h1>
        <p className="text-sm text-slate-500">
          Busque por protocolo, id ou nome do solicitante para visualizar o andamento completo do fluxo.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${card} flex flex-col gap-3 sm:flex-row`}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Protocolo, ID ou solicitante"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="space-y-4">
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Dados da Solicitação</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><b>Protocolo:</b> {result.solicitacao.protocolo}</p>
              <p><b>Tipo:</b> {result.solicitacao.tipo}</p>
              <p><b>Solicitante:</b> {result.solicitacao.solicitante}</p>
              <p><b>Status Geral:</b> {result.solicitacao.status}</p>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Etapa Atual</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><b>Nome da etapa:</b> {result.etapaAtual.nome}</p>
              <p><b>Tipo:</b> {result.etapaAtual.tipo}</p>
              <p><b>Departamento atual:</b> {result.etapaAtual.departamento ?? '—'}</p>
              <p><b>Responsável atual:</b> {result.etapaAtual.responsavelAtual ?? '—'}</p>
              <p>
                <b>Status:</b>{' '}
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(result.etapaAtual.status)}`}>
                  {result.etapaAtual.status}
                </span>
              </p>
            </div>
          </section>

          {result.etapaAtual.tipo === 'APPROVERS' && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Aprovação</h2>
              <div className="space-y-2 text-sm">
                {result.aprovacoes.length === 0 && <p className="text-slate-500">Sem aprovadores definidos.</p>}
                {result.aprovacoes.map((item) => (
                  <div key={item.aprovador} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span>{item.aprovador}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Histórico do Fluxo</h2>
            <div className="space-y-2">
              {result.historico.map((item, index) => (
                <div key={`${item.etapa}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">{item.etapa}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-slate-600">Tipo: {item.tipo}</p>
                  <p className="text-slate-600">Início: {fmtDate(item.dataInicio)}</p>
                  <p className="text-slate-600">Fim: {fmtDate(item.dataFim)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}