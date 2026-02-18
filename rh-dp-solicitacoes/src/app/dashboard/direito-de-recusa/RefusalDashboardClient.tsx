'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'

type RefusalStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

type RefusalReportRow = {
  id: string
  createdAt: string
  status: RefusalStatus
  riskSituation: string
  sectorOrContract: string
  employeeName: string
  contractManagerName?: string | null
  generalCoordinatorName?: string | null
  decision?: boolean | null
  decisionComment?: string | null
  decidedAt?: string | null
  decisionLevel?: string | null
}

type Props = {
  canReview: boolean
   title?: string
  description?: string
  defaultStatus?: '' | RefusalStatus
  showStatusFilter?: boolean
}

const statusBadge: Record<
  RefusalStatus,
  { label: string; className: string }
> = {
  PENDENTE: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
  APROVADA: { label: 'Procede', className: 'bg-emerald-100 text-emerald-800' },
  REJEITADA: { label: 'Não procede', className: 'bg-rose-100 text-rose-800' },
}

export default function RefusalDashboardClient({
  canReview,
  title = 'Direito de Recusa',
  description = 'Registre e acompanhe recusas de atividades por risco identificado. O colaborador abre o formulário e os responsáveis de nível 2 ou 3 avaliam se a situação procede.',
  defaultStatus = '',
  showStatusFilter = true,
}: Props) {
  const [reports, setReports] = useState<RefusalReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | RefusalStatus>(
    defaultStatus,
  )

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const qs = new URLSearchParams()
      if (statusFilter) qs.set('status', statusFilter)
      const res = await fetch(`/api/direito-de-recusa?${qs.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar registros.')
      }
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar registros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const emptyMessage = useMemo(() => {
    if (loading) return 'Carregando...'
    if (statusFilter) return 'Nenhum registro encontrado para o filtro selecionado.'
    return 'Nenhum direito de recusa registrado ainda.'
  }, [loading, statusFilter])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-orange-50 p-3 text-orange-700">
            <ShieldAlert size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase text-slate-500">Não Conformidades</p>
             <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-600 max-w-3xl">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/direito-de-recusa/nova"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          >
            Registrar recusa
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
          {showStatusFilter ? (
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-slate-600">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as RefusalStatus | '')}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="APROVADA">Procede</option>
                <option value="REJEITADA">Não procede</option>
              </select>
            </div>
          ) : (
            <div className="ml-auto" />
          )}
        </div>
        {error ? (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 border border-rose-200">
            {error}
          </div>
        ) : null}
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-2">Abertura</div>
          <div className="col-span-3">Situação de risco</div>
          <div className="col-span-2">Setor / Contrato</div>
           <div className="col-span-3">Responsáveis (N2 / N3)</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-slate-600">
            <Loader2 className="animate-spin" size={18} />
            Carregando
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-6 text-slate-500 text-sm">{emptyMessage}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.map((report) => {
              const badge = statusBadge[report.status]
              const responsibleNames = [
                report.contractManagerName ? `N2: ${report.contractManagerName}` : null,
                report.generalCoordinatorName ? `N3: ${report.generalCoordinatorName}` : null,
              ]
                .filter(Boolean)
                .join(' • ')
               return (
                <div key={report.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm text-slate-800">
                  <div className="col-span-2 text-slate-600">
                    <p>{format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                    <p className="text-xs text-slate-500">Por {report.employeeName}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="font-medium text-slate-900">{report.riskSituation}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{report.decisionComment}</p>
                  </div>
                  <div className="col-span-2 text-slate-700">{report.sectorOrContract}</div>
                  <div className="col-span-3 text-slate-700">
                    {responsibleNames || 'Não informado'}
                  </div>
                  <div className="col-span-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {report.decidedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {report.decision ? 'Procede' : 'Não procede'} ·{' '}
                        {format(new Date(report.decidedAt), 'dd/MM/yyyy HH:mm')}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Link
                      href={`/dashboard/direito-de-recusa/${report.id}`}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700"
                    >
                      {canReview && report.status === 'PENDENTE' ? 'Avaliar' : 'Detalhes'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}