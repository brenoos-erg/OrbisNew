'use client'

import { useEffect, useMemo, useState } from 'react'

type User = { id: string; fullName: string; email: string }
type TipoApprover = { userId: string; role: 'APPROVER' | 'VIEWER' | 'FINALIZER'; user: User }
type Tipo = { id: string; codigo: string; nome: string; approvers: TipoApprover[] }

export default function AprovadoresClient() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tipoId, setTipoId] = useState('')
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([])
  const [selectedFinalizers, setSelectedFinalizers] = useState<string[]>([])
  const [selectedViewers, setSelectedViewers] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const currentTipo = useMemo(() => tipos.find((t) => t.id === tipoId) ?? null, [tipos, tipoId])

  const load = async () => {
    const res = await fetch('/api/config/aprovadores-por-tipo', { cache: 'no-store' })
    const json = await res.json()
    setTipos(json.tipos ?? [])
    setUsers(json.users ?? [])
    const first = tipoId || json.tipos?.[0]?.id || ''
    setTipoId(first)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const entries = currentTipo?.approvers ?? []
    setSelectedApprovers(entries.filter((a) => a.role === 'APPROVER').map((a) => a.userId))
    setSelectedFinalizers(entries.filter((a) => a.role === 'FINALIZER').map((a) => a.userId))
    setSelectedViewers(entries.filter((a) => a.role === 'VIEWER').map((a) => a.userId))
  }, [currentTipo?.id])

  const toggleRole = (role: 'APPROVER' | 'VIEWER' | 'FINALIZER', userId: string, checked: boolean) => {
    if (role === 'APPROVER') {
      setSelectedApprovers((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)))
      if (checked) setSelectedViewers((prev) => prev.filter((id) => id !== userId))
      if (checked) setSelectedFinalizers((prev) => prev.filter((id) => id !== userId))
      return
    }

    if (role === 'FINALIZER') {
      setSelectedFinalizers((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)))
      if (checked) setSelectedViewers((prev) => prev.filter((id) => id !== userId))
      if (checked) setSelectedApprovers((prev) => prev.filter((id) => id !== userId))
      return
    }

    setSelectedViewers((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)))
    if (checked) setSelectedApprovers((prev) => prev.filter((id) => id !== userId))
  }
const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return users

    return users.filter((u) => {
      const haystack = `${u.fullName} ${u.email}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [search, users])

  const selectedUsers = useMemo(() => {
    const selectedSet = new Set([...selectedApprovers, ...selectedFinalizers, ...selectedViewers])
    return users
      .filter((u) => selectedSet.has(u.id))
      .map((u) => ({
        ...u,
        role: selectedApprovers.includes(u.id)
          ? 'Aprovador'
          : selectedFinalizers.includes(u.id)
            ? 'Finalizador'
            : 'Visualizador',
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
  }, [selectedApprovers, selectedFinalizers, selectedViewers, users])

  const save = async () => {
    await fetch('/api/config/aprovadores-por-tipo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoId,
        approvers: selectedApprovers,
        finalizers: selectedFinalizers,
        viewers: selectedViewers,
      }),
    })
    await load()
  }

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold">Aprovadores por tipo</h1>
      <select className="rounded border px-3 py-2" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} - {t.nome}
          </option>
        ))}
      </select>

      <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">
        Defina por usuário se ele atua como <strong>Aprovador</strong>, <strong>Finalizador</strong> ou{' '}
        <strong>Visualizador (Nível 1)</strong>.
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuário por nome ou e-mail"
            className="w-full rounded border px-3 py-2"
          />

          <div className="grid gap-2 md:grid-cols-2">
            {filteredUsers.map((u) => {
              const isApprover = selectedApprovers.includes(u.id)
              const isFinalizer = selectedFinalizers.includes(u.id)
              const isViewer = selectedViewers.includes(u.id)
              return (
                <div key={u.id} className="space-y-2 rounded border p-3">
                  <span>
                    {u.fullName} <span className="text-xs text-slate-500">({u.email})</span>
                  </span>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                         checked={isApprover}
                        onChange={(e) => toggleRole('APPROVER', u.id, e.target.checked)}
                      />
                      Aprovador
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isFinalizer}
                        onChange={(e) => toggleRole('FINALIZER', u.id, e.target.checked)}
                      />
                      Finalizador
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isViewer}
                        onChange={(e) => toggleRole('VIEWER', u.id, e.target.checked)}
                      />
                      Visualizador
                    </label>
                  </div>
                  {(isApprover || isFinalizer || isViewer) && (
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {isApprover ? 'Aprovador' : isFinalizer ? 'Finalizador' : 'Visualizador'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="rounded border border-dashed p-4 text-sm text-slate-500">
              Nenhum usuário encontrado para a busca informada.
             </div>
          )}
        </div>

        <div className="h-fit rounded border p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Com permissão no tipo selecionado</h2>
          <div className="overflow-hidden rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Permissão</th>
                </tr>
              </thead>
              <tbody>
                {selectedUsers.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.fullName}</td>
                    <td className="px-3 py-2">{u.role}</td>
                  </tr>
                ))}
                {selectedUsers.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-center text-slate-500">
                      Nenhum usuário com permissão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <button className="rounded bg-orange-500 px-3 py-2 text-white" onClick={save}>
        Salvar
      </button>
    </div>
  )
}