'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { nonConformityTypeLabel } from '@/lib/sst/serializers'

type Status = 'ABERTA' | 'AGUARDANDO_APROVACAO_QUALIDADE' | 'APROVADA_QUALIDADE' | 'EM_TRATATIVA' | 'AGUARDANDO_VERIFICACAO' | 'ENCERRADA' | 'CANCELADA'

type CostCenterOption = { id: string; code?: string | null; description: string }

type Item = {
  id: string
  numeroRnc: string
  status: Status
  tipoNc: string
  createdAt: string
  prazoAtendimento: string
  solicitanteNome: string
  aprovadoQualidadeStatus: string
  centroQueDetectou: { description: string }
  centroQueOriginou: { description: string }
}

const STATUS_META: Record<Status, { label: string; badgeClass: string }> = {
  ABERTA: { label: 'Aberta', badgeClass: 'app-status-badge app-status-badge--pending' },
  AGUARDANDO_APROVACAO_QUALIDADE: { label: 'Aguardando aprovação', badgeClass: 'app-status-badge app-status-badge--pending' },
  APROVADA_QUALIDADE: { label: 'Aprovada pela qualidade', badgeClass: 'app-status-badge app-status-badge--success' },
  EM_TRATATIVA: { label: 'Em tratativa', badgeClass: 'app-status-badge app-status-badge--pending' },
  AGUARDANDO_VERIFICACAO: { label: 'Aguardando verificação', badgeClass: 'app-status-badge app-status-badge--pending' },
  ENCERRADA: { label: 'Encerrada', badgeClass: 'app-status-badge app-status-badge--success' },
  CANCELADA: { label: 'Cancelada', badgeClass: 'app-status-badge app-status-badge--danger' },
}

export default function NaoConformidadesClient() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [centroQueDetectouId, setCentroQueDetectouId] = useState('')
  const [centroQueOriginouId, setCentroQueOriginouId] = useState('')
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const qs = useMemo(() => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (q) query.set('q', q)
    if (centroQueDetectouId) query.set('centroQueDetectouId', centroQueDetectouId)
    if (centroQueOriginouId) query.set('centroQueOriginouId', centroQueOriginouId)
    return query.toString()
  }, [centroQueDetectouId, centroQueOriginouId, q, status])

  async function loadCostCenters() {
    try {
      const res = await fetch('/api/cost-centers/select', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setCostCenters(Array.isArray(data) ? data : [])
    } catch {
      setCostCenters([])
    }
  }

  function clearFilters() {
    setQ('')
    setStatus('')
    setCentroQueDetectouId('')
    setCentroQueOriginouId('')
  }

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/sst/nao-conformidades?${qs}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Falha ao carregar lista.')
      }
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar lista.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCostCenters()
    fetch('/api/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsAdmin(data?.user?.role === 'ADMIN'))
      .catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    load()
  }, [qs])

  return (
    <section className="app-card space-y-4">
      <div className="app-filter-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número, descrição ou evidência"
          className="app-input min-w-[240px] flex-1"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="app-select w-full sm:w-auto">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        <select value={centroQueDetectouId} onChange={(e) => setCentroQueDetectouId(e.target.value)} className="app-select w-full sm:w-auto">
          <option value="">Centro que detectou</option>
          {costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.code ? `${cc.code} - ` : ''}{cc.description}</option>)}
        </select>
        <select value={centroQueOriginouId} onChange={(e) => setCentroQueOriginouId(e.target.value)} className="app-select w-full sm:w-auto">
          <option value="">Centro que originou</option>
          {costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.code ? `${cc.code} - ` : ''}{cc.description}</option>)}
        </select>
        <button type="button" onClick={clearFilters} className="app-button-secondary">Limpar filtros</button>
        <button type="button" onClick={load} className="app-button-secondary"><RefreshCcw size={14} />Atualizar</button>
        {isAdmin ? (
          <Link href="/dashboard/sgi/qualidade/nao-conformidades/alertas" className="app-button-secondary">
            Alertas de NC (Admin)
          </Link>
        ) : null}
      </div>

      {error ? <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 dark:text-rose-200">{error}</div> : null}

      <div className="app-table">
        <table>
          <thead className="app-table-header text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">RNC</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Detectou</th><th className="px-3 py-2">Originou</th><th className="px-3 py-2">Solicitante</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="app-table-row">
                <td className="px-3 py-2 font-semibold">{item.numeroRnc}</td>
                <td className="px-3 py-2"><span className={STATUS_META[item.status].badgeClass}>{STATUS_META[item.status].label}</span></td>
                <td className="px-3 py-2">{nonConformityTypeLabel[item.tipoNc as keyof typeof nonConformityTypeLabel] || item.tipoNc}</td>
                <td className="px-3 py-2">{new Date(item.prazoAtendimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2 app-muted-text">{item.centroQueDetectou?.description || '-'}</td>
                <td className="px-3 py-2 app-muted-text">{item.centroQueOriginou?.description || '-'}</td>
                <td className="px-3 py-2 app-muted-text">{item.solicitanteNome}</td>
                <td className="px-3 py-2 text-right"><Link href={`/dashboard/sgi/qualidade/nao-conformidades/${item.id}`} className="font-semibold text-orange-500 hover:text-orange-400">Detalhes</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? <p className="px-3 py-8 text-center text-sm app-muted-text">Nenhuma não conformidade encontrada.</p> : null}
      </div>
    </section>
  )
}
