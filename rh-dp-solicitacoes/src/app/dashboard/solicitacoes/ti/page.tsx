'use client'

import { useEffect, useMemo, useState } from 'react'

type TiRow = {
  id: string
  protocolo: string
  titulo: string
  status: string
  tiStatus: string | null
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE' | null
  dataAbertura: string
  dataPrevista: string | null
  tipo: { id: string; codigo: string; nome: string }
  solicitante: { fullName: string }
  assumidaPor: { id: string; fullName: string } | null
  anexos: Array<{ id: string; filename: string }>
  categoria: string | null
  slaState: 'SEM_SLA' | 'VENCIDO' | 'NO_PRAZO'
}

const PRIORIDADE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Crítica' },
]

export default function TiSolicitacoesDashboardPage() {
  const [rows, setRows] = useState<TiRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ protocolo: '', prioridade: '', status: '', categoria: '', solicitante: '', responsavel: '' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
      const response = await fetch(`/api/solicitacoes/ti?${params.toString()}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Erro ao carregar painel TI')
      setRows(json.rows ?? [])
      setStats(json.stats ?? null)
      setTotal(json.total ?? 0)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar painel TI')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cards = useMemo(
    () => [
      ['Abertos', stats?.abertos ?? 0],
      ['Triagem', stats?.triagem ?? 0],
      ['Em atendimento', stats?.emAtendimento ?? 0],
      ['Aguardando usuário', stats?.aguardandoUsuario ?? 0],
      ['Aguardando aprovação', stats?.aguardandoAprovacao ?? 0],
      ['Concluídos', stats?.concluidos ?? 0],
      ['Críticos', stats?.criticos ?? 0],
      ['Vencidos', stats?.vencidos ?? 0],
    ],
    [stats],
  )

  async function quickAction(solicitationId: string, action: 'assumir' | 'status' | 'prioridade', data?: Record<string, string>) {
    const response = await fetch('/api/solicitacoes/ti', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitationId, action, ...(data ?? {}) }),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => null)
      alert(json?.error ?? 'Falha ao executar ação rápida')
      return
    }
    await load()
  }

  return (
    <main className="space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-semibold">Painel operacional TI</h1>
        <p className="text-sm text-[var(--muted-foreground)]">/dashboard/solicitacoes/ti · catálogo RQ.TI.* · total: {total}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-3 md:grid-cols-6">
        <input className="rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" placeholder="Protocolo" value={filters.protocolo} onChange={(event) => setFilters((prev) => ({ ...prev, protocolo: event.target.value }))} />
        <input className="rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" placeholder="Categoria" value={filters.categoria} onChange={(event) => setFilters((prev) => ({ ...prev, categoria: event.target.value }))} />
        <input className="rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" placeholder="Status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} />
        <select className="rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" value={filters.prioridade} onChange={(event) => setFilters((prev) => ({ ...prev, prioridade: event.target.value }))}>
          {PRIORIDADE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input className="rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" placeholder="Solicitante" value={filters.solicitante} onChange={(event) => setFilters((prev) => ({ ...prev, solicitante: event.target.value }))} />
        <button onClick={load} className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white">Aplicar filtros</button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando chamados TI...</p> : null}

      <section className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--card)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--card-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Solicitante</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Prioridade</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Anexos</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border-subtle)]">
                <td className="px-3 py-2 font-medium text-[var(--foreground)]">{row.protocolo}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{row.tipo.codigo}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{row.tipo.nome}</p>
                </td>
                <td className="px-3 py-2">{row.solicitante?.fullName}</td>
                <td className="px-3 py-2">{row.tiStatus ?? row.status}</td>
                <td className="px-3 py-2">{row.prioridade ?? '-'}</td>
                <td className="px-3 py-2">
                  <p>{row.dataPrevista ? new Date(row.dataPrevista).toLocaleString('pt-BR') : '-'}</p>
                  <p className={`text-xs ${row.slaState === 'VENCIDO' ? 'text-red-600' : 'text-[var(--muted-foreground)]'}`}>{row.slaState}</p>
                </td>
                <td className="px-3 py-2">{row.anexos.map((anexo) => anexo.filename).join(', ') || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => quickAction(row.id, 'assumir')} className="rounded border border-[var(--input-border)] px-2 py-1 text-xs">Assumir</button>
                    <button onClick={() => quickAction(row.id, 'status', { status: 'EM_ATENDIMENTO' })} className="rounded border border-[var(--input-border)] px-2 py-1 text-xs">Atender</button>
                    <button onClick={() => quickAction(row.id, 'status', { status: 'CONCLUIDA' })} className="rounded border border-[var(--input-border)] px-2 py-1 text-xs">Concluir</button>
                    <button onClick={() => quickAction(row.id, 'status', { status: 'ABERTA' })} className="rounded border border-[var(--input-border)] px-2 py-1 text-xs">Reabrir</button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-[var(--muted-foreground)]" colSpan={8}>Nenhum chamado TI encontrado com os filtros atuais.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  )
}
