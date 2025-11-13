'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { format } from 'date-fns'

type Row = {
  id: string
  protocolo: string
  titulo: string
  tipo: string
  setorDestino: string
  status: string
  centroResponsavel: string | null
  solicitante: string
  dataAbertura: string // ISO
  sla: string | null
}
type ApiResult = { rows: Row[]; total: number }

export default function SolicitacoesPage() {
  // filtros
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [centro, setCentro] = useState('')
  const [tipo, setTipo] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [solicitante, setSolicitante] = useState('')
  const [status, setStatus] = useState('')
  const [textoForm, setTextoForm] = useState('')

  // paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // dados
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResult>({ rows: [], total: 0 })

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (dataIni) p.set('dataIni', dataIni)
    if (dataFim) p.set('dataFim', dataFim)
    if (centro) p.set('centro', centro)
    if (tipo) p.set('tipo', tipo)
    if (protocolo) p.set('protocolo', protocolo)
    if (solicitante) p.set('solicitante', solicitante)
    if (status) p.set('status', status)
    if (textoForm) p.set('texto', textoForm)
    p.set('page', String(page))
    p.set('pageSize', String(pageSize))
    return p.toString()
  }, [dataIni, dataFim, centro, tipo, protocolo, solicitante, status, textoForm, page, pageSize])

  useEffect(() => {
    (async () => {
      setLoading(true)
      const res = await fetch(`/api/solicitacoes?${qs}`, { cache: 'no-store' })
      const json = (await res.json()) as ApiResult
      setData(json)
      setLoading(false)
    })()
  }, [qs])

  const exportCsv = () => {
    const header = ['Protocolo','Data Abertura','Solicitação','SLA','Centro Responsável','Atendente','Status']
    const lines = data.rows.map(r => [
      r.protocolo,
      format(new Date(r.dataAbertura), 'dd/MM/yyyy HH:mm'),
      r.titulo,
      r.sla ?? '',
      r.centroResponsavel ?? '',
      r.solicitante,
      r.status,
    ])
    const csv = [header.join(';'), ...lines.map(l => l.map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `solicitacoes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize))

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="card p-3">

        <div className="p-4 border-b">
          <div className="text-lg font-semibold">Solicitações Realizadas</div>
        </div>

        {/* Filtros */}
        <div className="p-4 grid grid-cols-12 gap-3">
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Data Inicial</label>
            <input type="date" className="input" value={dataIni} onChange={e=>setDataIni(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Data Fim</label>
            <input type="date" className="input" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Centro Responsável</label>
            <input className="input" value={centro} onChange={e=>setCentro(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Categoria / Tipo</label>
            <input className="input" value={tipo} onChange={e=>setTipo(e.target.value)} />
          </div>

          <div className="col-span-3">
            <label className="text-xs text-slate-500">Protocolo</label>
            <input className="input" value={protocolo} onChange={e=>setProtocolo(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Solicitante</label>
            <input className="input" value={solicitante} onChange={e=>setSolicitante(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Status</label>
            <input className="input" value={status} onChange={e=>setStatus(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-500">Texto no Formulário</label>
            <input className="input" value={textoForm} onChange={e=>setTextoForm(e.target.value)} />
          </div>

          <div className="col-span-12 flex items-center gap-2">
            <button onClick={()=>setPage(1)} className="btn-primary flex items-center gap-2">
              <Search size={16} /> Pesquisar
            </button>
            <button onClick={exportCsv} className="btn ghost flex items-center gap-2">
              <Download size={16} /> Excel
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span>Mostrar</span>
              <select value={pageSize} onChange={e=>{setPageSize(+e.target.value); setPage(1)}}
                className="input h-9 w-24">
                {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>linhas</span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/70 text-slate-600">
              <tr>
                <th className="th">Status</th>
                <th className="th">Protocolo</th>
                <th className="th">Data Abertura</th>
                <th className="th">Solicitação</th>
                <th className="th">SLA</th>
                <th className="th">Centro Responsável</th>
                <th className="th">Atendente</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">Carregando...</td></tr>
              ) : data.rows.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum registro</td></tr>
              ) : data.rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="td"><span className={`badge ${badgeByStatus(r.status)}`}>{labelStatus(r.status)}</span></td>
                  <td className="td">{r.protocolo}</td>
                  <td className="td">{format(new Date(r.dataAbertura), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="td">{r.titulo}</td>
                  <td className="td">{r.sla ?? '-'}</td>
                  <td className="td">{r.centroResponsavel ?? '-'}</td>
                  <td className="td">{r.solicitante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-4 border-t flex items-center justify-between text-sm">
          <div>Exibindo {data.rows.length} de {data.total} registros</div>
          <div className="flex items-center gap-2">
            <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
            <div className="px-3 py-1 border rounded-md bg-white">{page}</div>
            <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input { @apply w-full h-10 px-3 rounded-md border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-slate-300; }
        .btn { @apply h-9 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50; }
        .btn-primary { @apply h-9 px-3 rounded-md bg-slate-900 text-white hover:bg-slate-800; }
        .btn.ghost { @apply bg-white border-slate-300; }
        .th { @apply text-left font-medium px-3 py-2; }
        .td { @apply px-3 py-2; }
        .badge { @apply inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium; }
      `}</style>
    </div>
  )
}

function labelStatus(s: string) {
  const map: Record<string,string> = {
    ABERTA: 'Aguardando', EM_ANALISE: 'Em análise', AGUARDANDO_INFO: 'Aguardando info',
    APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', CONCLUIDA: 'Concluída'
  }
  return map[s] ?? s
}
function badgeByStatus(s: string) {
  switch (s) {
    case 'ABERTA': return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'EM_ANALISE': return 'bg-sky-100 text-sky-700 border border-sky-200'
    case 'AGUARDANDO_INFO': return 'bg-rose-100 text-rose-700 border border-rose-200'
    case 'APROVADA': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'CONCLUIDA': return 'bg-green-100 text-green-700 border border-green-200'
    case 'REJEITADA': return 'bg-slate-200 text-slate-700 border border-slate-300'
    default: return 'bg-slate-100 text-slate-600 border border-slate-200'
  }
}
