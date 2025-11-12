// src/app/dashboard/configuracoes/usuarios/UserCostCenterPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

type CostCenter = {
  id: string
  description: string
}

type UserCostCenterLink = {
  id: string
  costCenterId: string
  userId: string
  costCenter?: CostCenter
}

export default function UserCostCenterPanel({ userId }: { userId: string }) {
  const [allCenters, setAllCenters] = useState<CostCenter[]>([])
  const [links, setLinks] = useState<UserCostCenterLink[]>([])
  const [selectedCenter, setSelectedCenter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Carrega todos os centros de custo (para o select)
  useEffect(() => {
    const loadCenters = async () => {
      try {
        const r = await fetch('/api/cost-centers/select', { cache: 'no-store' })
        const arr = await r.json().catch(() => [])
        // Garante que sempre seja um array
        setAllCenters(Array.isArray(arr) ? arr : [])
      } catch (err) {
        console.error('Erro ao carregar centros de custo:', err)
        setAllCenters([])
      }
    }
    loadCenters()
  }, [])

  // Carrega vínculos do usuário
  useEffect(() => {
    const loadLinks = async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/users/${userId}/cost-centers`, { cache: 'no-store' })
        const arr = await r.json().catch(() => [])
        setLinks(Array.isArray(arr) ? arr : [])
      } catch (err) {
        console.error('Erro ao carregar vínculos do usuário:', err)
        setLinks([])
      } finally {
        setLoading(false)
      }
    }
    loadLinks()
  }, [userId])

  // Adicionar vínculo
  async function add() {
    if (!selectedCenter) return alert('Selecione um centro de custo.')
    setSaving(true)
    try {
      const r = await fetch(`/api/users/${userId}/cost-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costCenterId: selectedCenter }),
      })
      if (!r.ok) {
        alert('Falha ao vincular centro de custo.')
        return
      }
      setSelectedCenter('')
      // Atualiza a lista
      const newLink = await r.json()
      setLinks((prev) => [...prev, newLink])
    } catch (err) {
      console.error('Erro ao adicionar vínculo:', err)
    } finally {
      setSaving(false)
    }
  }

  // Remover vínculo
  async function remove(linkId: string) {
    if (!confirm('Deseja remover este vínculo?')) return
    setSaving(true)
    try {
      const r = await fetch(`/api/users/${userId}/cost-centers/${linkId}`, {
        method: 'DELETE',
      })
      if (!r.ok) {
        alert('Falha ao remover vínculo.')
        return
      }
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch (err) {
      console.error('Erro ao remover vínculo:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-xl bg-white p-4">
      <h3 className="text-lg font-semibold mb-3">Centros de Custo vinculados</h3>

      {/* Seletor */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
          value={selectedCenter}
          onChange={(e) => setSelectedCenter(e.target.value)}
        >
          <option value="">Selecione centro de custo...</option>
          {allCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.description}
            </option>
          ))}
        </select>

        <button
          onClick={add}
          disabled={saving || !selectedCenter}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-slate-500 py-4">Carregando vínculos…</div>
      ) : links.length === 0 ? (
        <div className="text-sm text-slate-500 py-4">
          Nenhum centro de custo vinculado.
        </div>
      ) : (
        <table className="w-full text-sm border-t border-slate-200">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 px-2">Descrição</th>
              <th className="py-2 px-2 w-[100px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-2 px-2">
                  {l.costCenter?.description ||
                    allCenters.find((c) => c.id === l.costCenterId)?.description ||
                    '—'}
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => remove(l.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 text-red-600"
                  >
                    <Trash2 size={16} /> Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
