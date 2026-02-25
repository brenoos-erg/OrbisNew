'use client'

import { useEffect, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
export const dynamic = 'force-dynamic'

type Solicitation = {
  id: string
  titulo: string
  descricao: string
  status: string
  createdAt: string
  tipo?: { codigo: string; nome: string }
}

export default function SolicitacoesPage() {
  const [data, setData] = useState<Solicitation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function fetchSolicitacoes() {
    try {
      setLoading(true)
      const res = await fetch('/api/solicitacoes')
      const json = await res.json()
      setData(json.rows ?? [])
    } catch (e) {
      console.error('Erro ao buscar solicitações:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSolicitacoes()
  }, [])

  const filtered = data.filter((item) =>
    item.titulo.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Solicitações</h1>
          <p className="text-slate-500 text-sm">
            Visualize e gerencie as solicitações cadastradas.
          </p>
        </div>
        <button
          onClick={fetchSolicitacoes}
          className="flex items-center gap-2 text-sm bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-700"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4 border rounded-md px-3 py-2 w-80">
        <Search size={16} className="text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Título</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Tipo</th>
              <th className="text-left px-4 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-6 text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-6 text-slate-400">
                  Nenhuma solicitação encontrada
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-t hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2">{item.titulo}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'ABERTA'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{item.tipo ? `${item.tipo.codigo} - ${item.tipo.nome}` : '-'}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
