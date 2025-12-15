'use client'

import React, { useEffect, useState, type FormEvent } from 'react'

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

type ModuleLevelUser = {
  id: string
  fullName: string
  email: string
  department: { id: string; code: string; name: string } | null
}

type ModuleLevelPayload = {
  module: ModuleDTO
  users: { level: UserModuleAccessDTO['level']; user: ModuleLevelUser }[]
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

  // ---- Usuários por módulo (visualização) ----
  const [selectedModuleForLevels, setSelectedModuleForLevels] = useState<string>('')
  const [moduleLevelData, setModuleLevelData] = useState<ModuleLevelPayload | null>(null)
  const [loadingModuleLevels, setLoadingModuleLevels] = useState(false)

  const levelLabels: Record<UserModuleAccessDTO['level'], string> = {
    NIVEL_1: 'Nível 1',
    NIVEL_2: 'Nível 2',
    NIVEL_3: 'Nível 3',
  }

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

        const res = await fetch('/api/permissoes/departamentos', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar departamentos.')

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

  // seta módulo padrão pra visualizar níveis
  useEffect(() => {
    if (!deptData) return
    if (!selectedModuleForLevels && deptData.modules.length > 0) {
      setSelectedModuleForLevels(deptData.modules[0].id)
    }
  }, [deptData, selectedModuleForLevels])

  // =========================
  // HANDLERS DEPARTAMENTOS
  // =========================
  const isModuleEnabledForDept = (moduleId: string) => {
    if (!deptData || !selectedDeptId) return false
    return deptData.links.some((l) => l.departmentId === selectedDeptId && l.moduleId === moduleId)
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
        body: JSON.stringify({ departmentId: selectedDeptId, moduleId, enabled }),
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
          const exists = links.some((l) => l.departmentId === selectedDeptId && l.moduleId === moduleId)
          if (!exists) links = [...links, { departmentId: selectedDeptId, moduleId }]
        } else {
          links = links.filter((l) => !(l.departmentId === selectedDeptId && l.moduleId === moduleId))
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
  const handleLoadUser = async (e: FormEvent) => {
    e.preventDefault()
    if (!userEmailInput.trim()) return

    try {
      setLoadingUser(true)
      setError(null)
      setSuccess(null)
      setUserData(null)

      const params = new URLSearchParams({ email: userEmailInput.trim() })
      const res = await fetch(`/api/permissoes/usuarios?${params.toString()}`, { cache: 'no-store' })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar usuário.')
      }

      const json: UserPayload = await res.json()
      setUserData(json)

      if (!json.user) setError('Usuário não encontrado.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuário.')
    } finally {
      setLoadingUser(false)
    }
  }

  const getUserModuleLevel = (moduleId: string): UserModuleAccessDTO['level'] | null => {
    if (!userData) return null
    const item = userData.access.find((a) => a.moduleId === moduleId)
    return item?.level ?? null
  }

  const updateUserModuleLevel = async (moduleId: string, level: UserModuleAccessDTO['level'] | null) => {
    if (!userData?.user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.user.email, moduleId, level }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar nível do usuário.')
      }

      setUserData((prev) => {
        if (!prev) return prev

        let access = [...prev.access]

        if (!level) access = access.filter((a) => a.moduleId !== moduleId)
        else {
          const idx = access.findIndex((a) => a.moduleId === moduleId)
          if (idx >= 0) access[idx] = { ...access[idx], level }
          else access.push({ moduleId, level })
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

  const loadModuleLevels = async () => {
    if (!selectedModuleForLevels) return

    try {
      setLoadingModuleLevels(true)
      setError(null)
      setSuccess(null)

      const params = new URLSearchParams({ moduleId: selectedModuleForLevels })
      const res = await fetch(`/api/permissoes/modulos?${params.toString()}`, { cache: 'no-store' })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar níveis dos usuários do módulo.')
      }

      const json: ModuleLevelPayload = await res.json()
      setModuleLevelData(json)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar níveis dos usuários do módulo.')
    } finally {
      setLoadingModuleLevels(false)
    }
  }

  const updateModuleLevelForUser = async (targetUser: ModuleLevelUser, level: UserModuleAccessDTO['level']) => {
    if (!moduleLevelData) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetUser.email,
          moduleId: moduleLevelData.module.id,
          level,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar nível do usuário.')
      }

      setModuleLevelData((prev) => {
        if (!prev) return prev

        const users = prev.users
          .filter((entry) => entry.user.id !== targetUser.id)
          .concat([{ level, user: targetUser }])
          .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName))

        return { ...prev, users }
      })

      setSuccess('Nível do usuário atualizado.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar nível do usuário.')
    } finally {
      setSaving(false)
    }
  }

  const updateUserDepartment = async (departmentId: string | null) => {
    if (!userData?.user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.user.email, departmentId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar departamento do usuário.')
      }

      setUserData((prev) => {
        if (!prev || !prev.user) return prev
        return { ...prev, user: { ...prev.user, departmentId } }
      })

      setSuccess('Departamento do usuário atualizado.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar departamento do usuário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Permissões de Módulos</h1>

      <div className="flex gap-2 border-b pb-2">
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ${
            activeTab === 'departamentos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
          }`}
          onClick={() => setActiveTab('departamentos')}
        >
          Departamentos
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ${
            activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
          }`}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuários
        </button>
      </div>

      {error && <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">{success}</div>}

      {activeTab === 'departamentos' && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Permissões por Departamento</h2>

          {loadingDepartamentos && <p className="text-sm">Carregando...</p>}

          {deptData && (
            <>
              {/* BLOCO 1 */}
              <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
                  <p className="text-xs text-gray-500">Marque quais módulos este departamento pode enxergar.</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Módulos habilitados</p>
                  <div className="space-y-2">
                    {deptData.modules.map((m) => {
                      const enabled = isModuleEnabledForDept(m.id)
                      return (
                        <label key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={enabled}
                            onChange={(e) => toggleModuleForDept(m.id, e.target.checked)}
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

              {/* BLOCO 2 */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Usuários por nível do módulo</p>
                    <p className="text-xs text-gray-500">
                      Selecione um módulo e clique no botão para ver quais usuários estão em cada nível e setor.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      value={selectedModuleForLevels}
                      onChange={(e) => setSelectedModuleForLevels(e.target.value)}
                      disabled={!deptData.modules.length || loadingModuleLevels}
                    >
                      {deptData.modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      onClick={loadModuleLevels}
                      disabled={!selectedModuleForLevels || loadingModuleLevels}
                    >
                      {loadingModuleLevels ? 'Carregando...' : 'Mostrar níveis'}
                    </button>
                  </div>
                </div>

                {moduleLevelData && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">{moduleLevelData.module.name}</div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {(['NIVEL_1', 'NIVEL_2', 'NIVEL_3'] as const).map((level) => {
                        const list = moduleLevelData.users.filter((u) => u.level === level)

                        return (
                          <div key={level} className="space-y-2 rounded-md border p-3">
                            <div className="text-sm font-semibold">{levelLabels[level]}</div>

                            {list.length === 0 ? (
                              <p className="text-xs text-gray-500">Nenhum usuário neste nível.</p>
                            ) : (
                              <ul className="space-y-2 text-sm">
                                {list.map(({ user }) => (
                                  <li key={user.id} className="rounded-md bg-gray-50 px-2 py-2">
                                    <div className="font-medium">{user.fullName}</div>
                                    <div className="text-xs text-gray-600">{user.email}</div>
                                    <div className="text-xs text-gray-500">
                                      {user.department
                                        ? `${user.department.code} - ${user.department.name}`
                                        : 'Sem setor vinculado'}
                                    </div>

                                    <div className="mt-2 flex flex-col gap-1 text-xs text-gray-700">
                                      <label className="font-medium" htmlFor={`${user.id}-${level}`}>
                                        Mover para
                                      </label>
                                      <select
                                        id={`${user.id}-${level}`}
                                        className="w-full rounded-md border px-2 py-1 text-sm"
                                        value={level}
                                        disabled={saving}
                                        onChange={(e) =>
                                          updateModuleLevelForUser(user, e.target.value as UserModuleAccessDTO['level'])
                                        }
                                      >
                                        <option value="NIVEL_1">Nível 1</option>
                                        <option value="NIVEL_2">Nível 2</option>
                                        <option value="NIVEL_3">Nível 3</option>
                                      </select>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'usuarios' && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Nível e Departamento por Usuário</h2>

          <form onSubmit={handleLoadUser} className="flex flex-col gap-2 md:flex-row md:items-end">
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
                <div className="text-xs text-gray-600">{userData.user.email}</div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Departamento do usuário</label>
                <select
                  className="w-full max-w-xs rounded-md border px-3 py-2 text-sm"
                  value={userData.user.departmentId ?? ''}
                  disabled={saving}
                  onChange={(e) => updateUserDepartment(e.target.value || null)}
                >
                  <option value="">(sem departamento)</option>
                  {userData.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Aqui você vincula o cadastro do usuário a um departamento oficial.
                </p>
              </div>
            </div>
          )}

          {userData?.user && (
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
                          const value = e.target.value as 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | ''
                          updateUserModuleLevel(m.id, value === '' ? null : value)
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
                * Todos usuários novos começam como NIVEL_1 (no backend). Aqui é só para elevar ou tirar acesso quando
                necessário.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
