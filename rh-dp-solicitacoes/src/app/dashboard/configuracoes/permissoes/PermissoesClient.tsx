'use client'

import React, { useEffect, useState } from 'react'

type ModuleDTO = {
  id: string
  key: string
  name: string
}

type DepartmentDTO = {
  id: string
  code: string
  name: string
}

type DepartmentModuleLink = {
  departmentId: string
  moduleId: string
}

type UserDTO = {
  id: string
  fullName: string
  email: string
  departmentId: string | null
}

type UserModuleAccessDTO = {
  moduleId: string
  level: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'
}

type DepartmentPayload = {
  departments: DepartmentDTO[]
  modules: ModuleDTO[]
  links: DepartmentModuleLink[]
}

type UserPayload = {
  user: UserDTO | null
  modules: ModuleDTO[]
  access: UserModuleAccessDTO[]
  departments: DepartmentDTO[]
}

type Tab = 'departamentos' | 'usuarios'

export default function PermissoesClient() {
  const [activeTab, setActiveTab] = useState<Tab>('departamentos')

  // ---- Departamentos ----
  const [deptData, setDeptData] = useState<DepartmentPayload | null>(null)
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(false)

  // ---- Usuários ----
  const [userEmailInput, setUserEmailInput] = useState('')
  const [userData, setUserData] = useState<UserPayload | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // =========================
  // CARREGAR DADOS DEPARTAMENTOS
  // =========================
  useEffect(() => {
    if (activeTab !== 'departamentos') return
    if (deptData) return

    const load = async () => {
      try {
        setLoadingDepartamentos(true)
        setError(null)
        const res = await fetch('/api/permissoes/departamentos', {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error('Falha ao carregar departamentos.')
        }
        const json: DepartmentPayload = await res.json()
        setDeptData(json)
        if (!selectedDeptId && json.departments.length > 0) {
          setSelectedDeptId(json.departments[0].id)
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar departamentos.')
      } finally {
        setLoadingDepartamentos(false)
      }
    }

    load()
  }, [activeTab, deptData, selectedDeptId])

  // =========================
  // HANDLERS DEPARTAMENTOS
  // =========================
  const isModuleEnabledForDept = (moduleId: string) => {
    if (!deptData || !selectedDeptId) return false
    return deptData.links.some(
      (l) => l.departmentId === selectedDeptId && l.moduleId === moduleId,
    )
  }

  const toggleModuleForDept = async (moduleId: string, enabled: boolean) => {
    if (!selectedDeptId) return
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          moduleId,
          enabled,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao salvar permissão do departamento.')
      }

      // Atualiza state local (otimista)
      setDeptData((prev) => {
        if (!prev) return prev
        let links = prev.links
        if (enabled) {
          const exists = links.some(
            (l) => l.departmentId === selectedDeptId && l.moduleId === moduleId,
          )
          if (!exists) {
            links = [...links, { departmentId: selectedDeptId, moduleId }]
          }
        } else {
          links = links.filter(
            (l) =>
              !(
                l.departmentId === selectedDeptId &&
                l.moduleId === moduleId
              ),
          )
        }
        return { ...prev, links }
      })

      setSuccess('Permissão do departamento atualizada.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar permissão do departamento.')
    } finally {
      setSaving(false)
    }
  }

  // =========================
  // CARREGAR DADOS DO USUÁRIO
  // =========================
  const handleLoadUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userEmailInput.trim()) return

    try {
      setLoadingUser(true)
      setError(null)
      setSuccess(null)
      setUserData(null)

      const params = new URLSearchParams({ email: userEmailInput.trim() })
      const res = await fetch(`/api/permissoes/usuarios?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar usuário.')
      }

      const json: UserPayload = await res.json()
      setUserData(json)
      if (!json.user) {
        setError('Usuário não encontrado.')
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuário.')
    } finally {
      setLoadingUser(false)
    }
  }

  const getUserModuleLevel = (
    moduleId: string,
  ): UserModuleAccessDTO['level'] | null => {
    if (!userData) return null
    const item = userData.access.find((a) => a.moduleId === moduleId)
    return item?.level ?? null
  }

  const updateUserModuleLevel = async (
    moduleId: string,
    level: UserModuleAccessDTO['level'] | null,
  ) => {
    if (!userData?.user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.user.email,
          moduleId,
          level,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar nível do usuário.')
      }

      // Atualiza local
      setUserData((prev) => {
        if (!prev) return prev
        let access = [...prev.access]

        if (!level) {
          access = access.filter((a) => a.moduleId !== moduleId)
        } else {
          const idx = access.findIndex((a) => a.moduleId === moduleId)
          if (idx >= 0) {
            access[idx] = { ...access[idx], level }
          } else {
            access.push({ moduleId, level })
          }
        }

        return { ...prev, access }
      })

      setSuccess('Nível do usuário atualizado.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar nível do usuário.')
    } finally {
      setSaving(false)
    }
  }

  // ====== NOVO: alterar departamento do usuário ======
  const updateUserDepartment = async (departmentId: string | null) => {
    if (!userData?.user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.user.email,
          departmentId,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar departamento do usuário.')
      }

      // Atualiza local
      setUserData((prev) => {
        if (!prev || !prev.user) return prev
        return {
          ...prev,
          user: { ...prev.user, departmentId },
        }
      })

      setSuccess('Departamento do usuário atualizado.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar departamento do usuário.')
    } finally {
      setSaving(false)
    }
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Permissões de Módulos</h1>

      <div className="flex gap-2 border-b pb-2">
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ${
            activeTab === 'departamentos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-800'
          }`}
          onClick={() => setActiveTab('departamentos')}
        >
          Departamentos
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ${
            activeTab === 'usuarios'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-800'
          }`}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuários
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      {activeTab === 'departamentos' && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Permissões por Departamento</h2>

          {loadingDepartamentos && <p className="text-sm">Carregando...</p>}

          {deptData && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* SELECT DEPARTAMENTO */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={selectedDeptId ?? ''}
                  onChange={(e) => setSelectedDeptId(e.target.value || null)}
                >
                  {deptData.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Marque quais módulos este departamento pode enxergar.
                </p>
              </div>

              {/* CHECKBOX DE MÓDULOS */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Módulos habilitados</p>
                <div className="space-y-2">
                  {deptData.modules.map((m) => {
                    const enabled = isModuleEnabledForDept(m.id)
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={enabled}
                          onChange={(e) =>
                            toggleModuleForDept(m.id, e.target.checked)
                          }
                          disabled={saving}
                        />
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-gray-500">
                            key: <code>{m.key}</code>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'usuarios' && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Nível e Departamento por Usuário</h2>

          <form
            onSubmit={handleLoadUser}
            className="flex flex-col gap-2 md:flex-row md:items-end"
          >
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">E-mail do usuário</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="usuario@empresa.com.br"
                value={userEmailInput}
                onChange={(e) => setUserEmailInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={loadingUser}
            >
              {loadingUser ? 'Carregando...' : 'Carregar'}
            </button>
          </form>

          {userData?.user && (
            <div className="rounded-md border px-4 py-3 text-sm bg-gray-50 space-y-2">
              <div>
                <div className="font-medium">{userData.user.fullName}</div>
                <div className="text-xs text-gray-600">
                  {userData.user.email}
                </div>
              </div>

              {/* SELECT DEPARTAMENTO DO USUÁRIO */}
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Departamento do usuário
                </label>
                <select
                  className="w-full max-w-xs rounded-md border px-3 py-2 text-sm"
                  value={userData.user.departmentId ?? ''}
                  disabled={saving}
                  onChange={(e) =>
                    updateUserDepartment(e.target.value || null)
                  }
                >
                  <option value="">(sem departamento)</option>
                  {userData.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Aqui você vincula o cadastro do usuário a um departamento
                  oficial.
                </p>
              </div>
            </div>
          )}

          {userData && userData.user && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nível por módulo</p>
              <div className="space-y-2">
                {userData.modules.map((m) => {
                  const level = getUserModuleLevel(m.id)
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm md:flex-row md:items-center"
                    >
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-500">
                          key: <code>{m.key}</code>
                        </div>
                      </div>
                      <select
                        className="rounded-md border px-2 py-1 text-sm"
                        value={level ?? ''}
                        disabled={saving}
                        onChange={(e) => {
                          const value = e.target.value as
                            | 'NIVEL_1'
                            | 'NIVEL_2'
                            | 'NIVEL_3'
                            | ''

                          updateUserModuleLevel(
                            m.id,
                            value === '' ? null : value,
                          )
                        }}
                      >
                        <option value="">Sem acesso</option>
                        <option value="NIVEL_1">Nível 1</option>
                        <option value="NIVEL_2">Nível 2</option>
                        <option value="NIVEL_3">Nível 3</option>
                      </select>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500">
                * Todos usuários novos começam como NIVEL_1 (no backend).
                Aqui é só para elevar ou tirar acesso quando necessário.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
