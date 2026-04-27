'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'

type RefusalStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

type RefusalSummary = {
  id: string
  createdAt: string
  status: RefusalStatus
  riskSituation: string
  sectorOrContract: string
  contractManagerName?: string | null
  generalCoordinatorName?: string | null
  decision?: boolean | null
  decisionComment?: string | null
  decidedAt?: string | null
  decisionLevel?: string | null
}

const statusBadge: Record<RefusalStatus, { label: string; className: string }> = {
  PENDENTE: { label: 'Pendente', className: 'app-status-badge app-status-badge--pending' },
  APROVADA: { label: 'Procede', className: 'app-status-badge app-status-badge--success' },
  REJEITADA: { label: 'Não procede', className: 'app-status-badge app-status-badge--danger' },
}

export default function MyRefusalsClient() {
  const [reports, setReports] = useState<RefusalSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | RefusalStatus>('')

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const qs = new URLSearchParams()
      if (statusFilter) qs.set('status', statusFilter)
      const res = await fetch(`/api/direito-de-recusa/minhas?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar seus registros.')
      }
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar seus registros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const emptyMessage = useMemo(() => {
    if (loading) return 'Carregando...'
    if (statusFilter) return 'Nenhum registro encontrado para o filtro selecionado.'
    return 'Você ainda não registrou nenhum direito de recusa.'
  }, [loading, statusFilter])

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div className="rounded-full bg-orange-100 p-3 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
          <ShieldAlert size={20} />
        </div>
        <div className="space-y-1">
          <p className="app-muted-text text-sm font-semibold uppercase">Direito de Recusa</p>
          <h1 className="app-title">Meus direitos de recusa</h1>
          <p className="app-subtitle max-w-3xl">
            Acompanhe as recusas que você registrou, consulte o parecer dos responsáveis e continue o acompanhamento sem precisar acessar o painel de avaliação.
          </p>
        </div>
      </header>

      <div className="app-filter-bar">
        <Link href="/dashboard/direito-de-recusa/nova" className="app-button-primary w-full sm:w-auto">Registrar nova recusa</Link>
        <button type="button" onClick={load} className="app-button-secondary w-full sm:w-auto"><RefreshCcw size={16} />Atualizar</button>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <label className="text-sm app-muted-text">Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RefusalStatus | '')} className="app-select w-full sm:w-[220px]">
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="APROVADA">Procede</option>
            <option value="REJEITADA">Não procede</option>
          </select>
        </div>
      </div>

      {error ? <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

      <div className="app-table">
        <table>
          <thead className="app-table-header text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Abertura</th>
              <th className="px-4 py-3 text-left">Situação de risco</th>
              <th className="px-4 py-3 text-left">Setor / Contrato</th>
              <th className="px-4 py-3 text-left">Responsáveis</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="app-table-row"><td colSpan={6} className="px-4 py-6"><span className="inline-flex items-center gap-2 app-muted-text"><Loader2 className="animate-spin" size={18} />Carregando</span></td></tr>
            ) : reports.length === 0 ? (
              <tr className="app-table-row"><td colSpan={6} className="px-4 py-8 text-sm app-muted-text">{emptyMessage}</td></tr>
            ) : reports.map((report) => {
              const badge = statusBadge[report.status]
              const responsibleNames = [
                report.contractManagerName ? `N2: ${report.contractManagerName}` : null,
                report.generalCoordinatorName ? `N3: ${report.generalCoordinatorName}` : null,
              ].filter(Boolean).join(' • ')

              return (
                <tr key={report.id} className="app-table-row">
                  <td className="px-4 py-3">{format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{report.riskSituation}</p>
                    {report.decisionComment ? <p className="line-clamp-2 text-xs app-muted-text">{report.decisionComment}</p> : null}
                  </td>
                  <td className="px-4 py-3 app-muted-text">{report.sectorOrContract}</td>
                  <td className="px-4 py-3 app-muted-text">{responsibleNames || 'Não informado'}</td>
                  <td className="px-4 py-3">
                    <span className={badge.className}>{badge.label}</span>
                    {report.decidedAt ? <p className="mt-1 text-xs app-muted-text">{report.decision ? 'Procede' : 'Não procede'} · {format(new Date(report.decidedAt), 'dd/MM/yyyy HH:mm')}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right"><Link href={`/dashboard/direito-de-recusa/${report.id}`} className="font-semibold text-orange-500 hover:text-orange-400">Ver detalhes</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
