'use client'

import { FormEvent, useMemo, useState } from 'react'

type ModuleLevel = 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'

type UserPayload = {
  user: {
    id: string
    fullName: string
    email: string
    departmentId: string | null
  } | null
  modules: { id: string; key: string; name: string }[]
  access: { moduleId: string; level: ModuleLevel }[]
  departments: { id: string; code: string; name: string }[]
}

const LEVEL_OPTIONS: { value: ModuleLevel | ''; label: string }[] = [
  { value: '', label: 'Sem acesso' },
  { value: 'NIVEL_1', label: 'Nível 1' },
  { value: 'NIVEL_2', label: 'Nível 2' },
  { value: 'NIVEL_3', label: 'Nível 3' },
]

export default function PoderesDeAcessoClient() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [data, setData] = useState<UserPayload | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState('')

  const selectedLevel = useMemo(() => {
    if (!data || !selectedModuleId) return ''
    return data.access.find((row) => row.moduleId === selectedModuleId)?.level ?? ''
  }, [data, selectedModuleId])

  const onSearch = async (event: FormEvent) => {
    event.preventDefault()
    const term = search.trim()

    if (!term) {
      setError('Informe nome ou e-mail para pesquisar.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const params = new URLSearchParams({ search: term })
      const response = await fetch(`/api/permissoes/usuarios?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao buscar usuário.')
      }

      setData(payload)
      setSelectedModuleId(payload.modules[0]?.id ?? '')
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar usuário.')
      setData(null)
      setSelectedModuleId('')
    } finally {
      setLoading(false)
    }
  }

  const patchPermissions = async (body: Record<string, unknown>, successMessage: string) => {
    if (!data?.user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.user.email, ...body }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao salvar alterações.')
      }

      setData(payload)
      setSuccess(successMessage)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Poderes de Acesso</h1>
        <p className="mt-1 text-sm text-slate-500">Ajuste departamento padrão e nível por módulo para usuários específicos.</p>
      </div>

      <form onSubmit={onSearch} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <label className="text-sm font-medium text-slate-700">Buscar por nome ou e-mail</label>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
            placeholder="ex.: maria@empresa.com"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

      {data?.user && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h2 className="font-medium text-slate-800">{data.user.fullName}</h2>
            <p className="text-sm text-slate-500">{data.user.email}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Departamento padrão</label>
              <select
                value={data.user.departmentId ?? ''}
                disabled={saving}
                onChange={(event) => {
                  void patchPermissions(
                    { departmentId: event.target.value || null },
                    'Departamento atualizado com sucesso.',
                  )
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                <option value="">Sem departamento</option>
                {data.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Módulo</label>
              <select
                value={selectedModuleId}
                onChange={(event) => setSelectedModuleId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                {data.modules.map((module) => (
                  <option key={module.id} value={module.id}>{module.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nível no módulo</label>
            <select
              value={selectedLevel}
              disabled={!selectedModuleId || saving}
              onChange={(event) => {
                if (!selectedModuleId) return
                void patchPermissions(
                  { moduleId: selectedModuleId, level: event.target.value },
                  'Nível de acesso atualizado com sucesso.',
                )
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {data && !data.user && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Nenhum usuário encontrado para esse termo.</p>
      )}
    </div>
  )
}