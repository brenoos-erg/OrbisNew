'use client'

import { useEffect, useMemo, useState } from 'react'

type User = {
  id: string
  fullName: string
  email: string
}

type ApiResponse = {
  users: User[]
  selectedUserIds: string[]
}

export default function CoordenadoresAvaliacaoExperienciaClient() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function load() {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/configuracoes/coordenadores-avaliacao-experiencia', {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Falha ao carregar coordenadores.')
      const data = (await res.json()) as ApiResponse
      setUsers(data.users ?? [])
      setSelectedUserIds(data.selectedUserIds ?? [])
    } catch (error) {
      setFeedback({ type: 'error', message: 'Não foi possível carregar os coordenadores.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds])

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return users

    return users.filter((user) => {
      const text = `${user.fullName} ${user.email}`.toLowerCase()
      return text.includes(normalized)
    })
  }, [users, search])

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedSet.has(user.id)),
    [users, selectedSet],
  )

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function save() {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/configuracoes/coordenadores-avaliacao-experiencia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      })
      if (!res.ok) throw new Error('Falha ao salvar coordenadores.')

      setFeedback({ type: 'success', message: 'Coordenadores atualizados com sucesso.' })
      await load()
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao salvar coordenadores.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold">Coordenadores da Avaliação do Período de Experiência</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Selecione os usuários que poderão realizar a avaliação do gestor imediato no período de
        experiência.
      </p>

      {feedback && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded border p-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar usuário por nome ou e-mail"
            className="w-full rounded border px-3 py-2"
          />

          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Carregando usuários...</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filteredUsers.map((user) => (
                <label key={user.id} className="rounded border p-3 text-sm">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="font-medium">{user.fullName}</strong>
                      <span className="block text-xs text-[var(--muted-foreground)]">{user.email}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="rounded border border-dashed p-4 text-sm text-[var(--muted-foreground)]">
              Nenhum usuário encontrado para a busca informada.
            </div>
          )}
        </div>

        <div className="h-fit rounded border p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Selecionados</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{selectedUsers.length} coordenador(es)</p>

          <ul className="mt-3 space-y-2 text-sm">
            {selectedUsers.map((user) => (
              <li key={user.id} className="rounded bg-[var(--card-muted)] px-2 py-1.5">
                {user.fullName}
              </li>
            ))}
            {selectedUsers.length === 0 && (
              <li className="text-[var(--muted-foreground)]">Nenhum coordenador selecionado.</li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="rounded bg-orange-500 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Salvando...' : 'Salvar coordenadores'}
      </button>
    </div>
  )
}