'use client'

import { useEffect, useState } from 'react'

type CentroCusto = {
  id: string
  nome: string
}

type UserCostCenterPanelProps = {
  userId: string
}

export function UserCostCenterPanel({ userId }: UserCostCenterPanelProps) {
  const [todosCC, setTodosCC] = useState<CentroCusto[]>([])
  const [vinculados, setVinculados] = useState<CentroCusto[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  const [loadingAll, setLoadingAll] = useState(false)
  const [loadingUser, setLoadingUser] = useState(false)
  const [saving, setSaving] = useState(false)

  /** ------------------ carregar TODOS os centros de custo ------------------ */
  useEffect(() => {
    async function loadAll() {
      try {
        setLoadingAll(true)

        // mesma rota usada na tela "Nova Solicitação"
        const res = await fetch('/api/cost-centers/select', {
          cache: 'no-store',
        })

        if (!res.ok) {
          console.error('Erro ao buscar centros de custo (all)')
          setTodosCC([])
          return
        }

        const json: {
          id: string
          code: string | null
          description: string
        }[] = await res.json()

        const mapped: CentroCusto[] = json.map((c) => ({
          id: c.id,
          nome: c.code ? `${c.code} - ${c.description}` : c.description,
        }))

        setTodosCC(mapped)
      } catch (err) {
        console.error('Erro ao carregar todos os centros de custo', err)
        setTodosCC([])
      } finally {
        setLoadingAll(false)
      }
    }

    loadAll()
  }, []) // carrega só uma vez – independe do usuário

  /** ------------------ carregar vínculos do USUÁRIO ------------------ */
  useEffect(() => {
    if (!userId) return

    async function loadUserLinks() {
      try {
        setLoadingUser(true)
        setSelectedId('') // limpa seleção quando troca de usuário

        const res = await fetch(`/api/users/${userId}/cost-centers`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          console.error('Erro ao buscar centros vinculados do usuário')
          setVinculados([])
          return
        }

        const json: {
          costCenter: {
            id: string
            code: string | null
            description: string
          }
        }[] = await res.json()

        const mapped: CentroCusto[] = json.map((link) => ({
          id: link.costCenter.id,
          nome: link.costCenter.code
            ? `${link.costCenter.code} - ${link.costCenter.description}`
            : link.costCenter.description,
        }))

        setVinculados(mapped)
      } catch (err) {
        console.error('Erro ao carregar vínculos de centro de custo do usuário', err)
        setVinculados([])
      } finally {
        setLoadingUser(false)
      }
    }

    loadUserLinks()
  }, [userId]) // ✅ recarrega sempre que muda o usuário

  /** ------------------ adicionar vínculo ------------------ */
  async function handleAdd() {
    if (!selectedId || !userId) return

    try {
      setSaving(true)

      const res = await fetch(`/api/users/${userId}/cost-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costCenterId: selectedId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao salvar vínculo de centro de custo.')
      }

      // recarrega vínculos do usuário
      const reload = await fetch(`/api/users/${userId}/cost-centers`, {
        cache: 'no-store',
      })
      const json: {
        costCenter: { id: string; code: string | null; description: string }
      }[] = await reload.json()

      const mapped: CentroCusto[] = json.map((link) => ({
        id: link.costCenter.id,
        nome: link.costCenter.code
          ? `${link.costCenter.code} - ${link.costCenter.description}`
          : link.costCenter.description,
      }))

      setVinculados(mapped)
    } catch (err: any) {
      alert(err.message ?? 'Erro ao vincular centro de custo.')
    } finally {
      setSaving(false)
    }
  }

  /** ------------------ remover vínculo ------------------ */
  async function handleRemove(ccId: string) {
    if (!userId) return

    try {
      setSaving(true)

      const res = await fetch(
        `/api/users/${userId}/cost-centers?costCenterId=${encodeURIComponent(
          ccId,
        )}`,
        { method: 'DELETE' },
      )

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao remover vínculo.')
      }

      setVinculados((prev) => prev.filter((c) => c.id !== ccId))
    } catch (err: any) {
      alert(err.message ?? 'Erro ao remover vínculo de centro de custo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white/80 p-4">
      <h2 className="text-sm font-semibold text-slate-800 mb-2">
        Centros de Custo vinculados
      </h2>

      <div className="flex gap-2 items-center mb-3">
        <select
          className="flex-1 rounded-md border border-slate-300 text-sm px-3 py-2"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingAll || saving || todosCC.length === 0}
        >
          <option value="">
            {loadingAll
              ? 'Carregando centros de custo...'
              : todosCC.length === 0
              ? 'Nenhum centro de custo cadastrado.'
              : 'Selecione centro de custo...'}
          </option>
          {todosCC.map((cc) => (
            <option key={cc.id} value={cc.id}>
              {cc.nome}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedId || saving}
          className="rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Salvando...' : '+ Adicionar'}
        </button>
      </div>

      {loadingUser ? (
        <p className="text-xs text-slate-500">Carregando vínculos...</p>
      ) : vinculados.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum centro de custo vinculado.
        </p>
      ) : (
        <ul className="space-y-1">
          {vinculados.map((cc) => (
            <li
              key={cc.id}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span>{cc.nome}</span>
              <button
                type="button"
                onClick={() => handleRemove(cc.id)}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
