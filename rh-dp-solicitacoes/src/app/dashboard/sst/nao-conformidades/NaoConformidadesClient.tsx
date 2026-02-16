'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw } from 'lucide-react'

type Status = 'ABERTA' | 'AGUARDANDO_APROVACAO_QUALIDADE' | 'APROVADA_QUALIDADE' | 'EM_TRATATIVA' | 'AGUARDANDO_VERIFICACAO' | 'ENCERRADA' | 'CANCELADA'

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

const STATUS_META: Record<Status, { label: string; className: string }> = {
  ABERTA: { label: 'Aberta', className: 'bg-amber-100 text-amber-800' },
  AGUARDANDO_APROVACAO_QUALIDADE: { label: 'Aguardando aprovação', className: 'bg-orange-100 text-orange-800' },
  APROVADA_QUALIDADE: { label: 'Aprovada pela qualidade', className: 'bg-teal-100 text-teal-800' },
  EM_TRATATIVA: { label: 'Em tratativa', className: 'bg-sky-100 text-sky-800' },
  AGUARDANDO_VERIFICACAO: { label: 'Aguardando verificação', className: 'bg-violet-100 text-violet-800' },
  ENCERRADA: { label: 'Encerrada', className: 'bg-emerald-100 text-emerald-800' },
  CANCELADA: { label: 'Cancelada', className: 'bg-rose-100 text-rose-800' },
}
export default function NaoConformidadesClient() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  const qs = useMemo(() => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (q) query.set('q', q)
    return query.toString()
  }, [q, status])

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
    load()
  }, [qs])

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, descrição ou evidência" className="min-w-[240px] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><RefreshCcw size={14} />Atualizar</button>
      </div>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">RNC</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Detectou</th><th className="px-3 py-2">Originou</th><th className="px-3 py-2">Solicitante</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-semibold text-slate-800">{item.numeroRnc}</td>
                <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${STATUS_META[item.status].className}`}>{STATUS_META[item.status].label}</span></td>
                  <td className="px-3 py-2">{item.tipoNc}</td>
                <td className="px-3 py-2">{new Date(item.prazoAtendimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2">{item.centroQueDetectou?.description || '-'}</td>
                <td className="px-3 py-2">{item.centroQueOriginou?.description || '-'}</td>
                <td className="px-3 py-2">{item.solicitanteNome}</td>
                <td className="px-3 py-2 text-right"><Link href={`/dashboard/sst/nao-conformidades/${item.id}`} className="text-orange-600 hover:text-orange-700">Detalhes</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma não conformidade encontrada.</p> : null}
      </div>
    </div>
  )
}