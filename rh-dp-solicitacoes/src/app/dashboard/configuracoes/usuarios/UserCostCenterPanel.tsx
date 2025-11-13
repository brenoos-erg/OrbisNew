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

const SELECT = 'input flex-1'

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
        const r = await fetch(`/api/users/${userId}/cost-centers`, {
          cache: 'no-store',
        })
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
    <div className="card p-4">
      <h3 className="text-sm font-semibold mb-3 text-[var(--foreground)]">
        Centros de Custo vinculados
      </h3>

      {/* Seletor */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          className={SELECT}
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
        <div className="text-sm text-slate-400 py-4">
          Carregando vínculos…
        </div>
      ) : links.length === 0 ? (
        <div className="text-sm text-slate-400 py-4">
          Nenhum centro de custo vinculado.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr className="text-left text-slate-400">
              <th className="py-2 px-2">Descrição</th>
              <th className="py-2 px-2 w-[100px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="table-row">
                <td className="py-2 px-2">
                  {l.costCenter?.description ||
                    allCenters.find((c) => c.id === l.costCenterId)
                      ?.description ||
                    '—'}
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => remove(l.id)}
                    disabled={saving}
                    className="btn-table btn-table-danger inline-flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Remover
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
