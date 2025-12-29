'use client'

import { useEffect, useState } from 'react'

type DepartmentOption = {
  id: string
  label: string
}

type UserDepartmentLink = {
  departmentId: string
  label: string
  isPrimary: boolean
  canRemove: boolean
}

type Props = {
  userId: string
}

export function UserDepartmentPanel({ userId }: Props) {
  const [allDepartments, setAllDepartments] = useState<DepartmentOption[]>([])
  const [links, setLinks] = useState<UserDepartmentLink[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [setPrimary, setSetPrimary] = useState(false)

  const [loadingAll, setLoadingAll] = useState(false)
  const [loadingUser, setLoadingUser] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadAll() {
      try {
        setLoadingAll(true)
        const res = await fetch('/api/departments', { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao buscar departamentos.')

        const json: { id: string; label: string; description: string | null }[] = await res.json()
        setAllDepartments(json.map((d) => ({ id: d.id, label: d.description ? `${d.description} - ${d.label}` : d.label })))
      } catch (e) {
        console.error(e)
        setAllDepartments([])
      } finally {
        setLoadingAll(false)
      }
    }

    loadAll()
  }, [])

  useEffect(() => {
    if (!userId) return

    async function loadUserLinks() {
      try {
        setLoadingUser(true)
        const res = await fetch(`/api/users/${userId}/departments`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao carregar departamentos do usuário.')

        const json: {
          departmentId: string
          label: string
          isPrimary: boolean
          canRemove: boolean
        }[] = await res.json()

        setLinks(
          json.map((item) => ({
            departmentId: item.departmentId,
            label: item.label,
            isPrimary: item.isPrimary,
            canRemove: item.canRemove,
          })),
        )
      } catch (e) {
        console.error(e)
        setLinks([])
      } finally {
        setLoadingUser(false)
      }
    }

    loadUserLinks()
  }, [userId])

  async function handleAdd() {
    if (!selectedId) return

    try {
      setSaving(true)
      const res = await fetch(`/api/users/${userId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: selectedId, setAsPrimary: setPrimary }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao vincular departamento.')
      }

      const reload = await fetch(`/api/users/${userId}/departments`, { cache: 'no-store' })
      const json: any[] = await reload.json()
      setLinks(
        json.map((item) => ({
          departmentId: item.departmentId,
          label: item.label,
          isPrimary: item.isPrimary,
          canRemove: item.canRemove,
        })),
      )
      setSelectedId('')
      setSetPrimary(false)
    } catch (e: any) {
      alert(e?.message || 'Erro ao vincular departamento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(departmentId: string) {
    try {
      setSaving(true)
      const params = new URLSearchParams({ departmentId })
      const res = await fetch(`/api/users/${userId}/departments?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Não foi possível remover.')
      }

      setLinks((prev) => prev.filter((l) => l.departmentId !== departmentId))
    } catch (e: any) {
      alert(e?.message || 'Erro ao remover departamento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetPrimary(departmentId: string) {
    try {
      setSaving(true)
      const res = await fetch(`/api/users/${userId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, setAsPrimary: true }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao definir principal.')
      }

      const reload = await fetch(`/api/users/${userId}/departments`, { cache: 'no-store' })
      const json: any[] = await reload.json()
      setLinks(
        json.map((item) => ({
          departmentId: item.departmentId,
          label: item.label,
          isPrimary: item.isPrimary,
          canRemove: item.canRemove,
        })),
      )
    } catch (e: any) {
      alert(e?.message || 'Erro ao definir departamento principal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">Departamentos vinculados</h2>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
        <select
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingAll || saving || allDepartments.length === 0}
        >
          <option value="">
            {loadingAll
              ? 'Carregando departamentos...'
              : allDepartments.length === 0
                ? 'Nenhum departamento cadastrado.'
                : 'Selecione um departamento...'}
          </option>
          {allDepartments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={setPrimary}
            onChange={(e) => setSetPrimary(e.target.checked)}
            disabled={saving}
          />
          Definir como principal
        </label>

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
        <p className="text-xs text-slate-500">Carregando departamentos vinculados...</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum departamento vinculado.</p>
      ) : (
        <ul className="space-y-1">
          {links.map((link) => (
            <li
              key={link.departmentId}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{link.label}</span>
                {link.isPrimary && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                    Principal
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {!link.isPrimary && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
                    onClick={() => handleSetPrimary(link.departmentId)}
                    disabled={saving}
                  >
                    Definir como principal
                  </button>
                )}
                {link.canRemove ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-60"
                    onClick={() => handleRemove(link.departmentId)}
                    disabled={saving}
                  >
                    remover
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">Principal</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}