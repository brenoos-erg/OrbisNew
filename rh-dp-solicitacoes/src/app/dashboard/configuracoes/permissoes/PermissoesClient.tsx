'use client'

import React, { useEffect, useState, type FormEvent } from 'react'

type FeatureAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE'
type ModuleLevel = 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'

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
  department: { id: string; code: string; name: string } | null
  users: { level: UserModuleAccessDTO['level'] | null; user: ModuleLevelUser }[]
}
type DepartmentUser = {
  id: string
  fullName: string
  email: string
  departmentId: string | null
  isMember: boolean
  isPrimary?: boolean
  canRemove?: boolean
}
type FeatureDTO = {
  id: string
  key: string
  name: string
}
type FeatureLevelGrantDTO = {
  id: string
  featureId: string
  level: ModuleLevel
  actions: FeatureAction[]
}
type FeaturePayload = {
  module: ModuleDTO
  features: FeatureDTO[]
  levelGrants: FeatureLevelGrantDTO[]
}
type Tab = 'departamentos' | 'usuarios' | 'submodulos'

const LEVELS: { id: ModuleLevel; label: string }[] = [
  { id: 'NIVEL_1', label: 'Nível 1' },
  { id: 'NIVEL_2', label: 'Nível 2' },
  { id: 'NIVEL_3', label: 'Nível 3' },
]


export default function PermissoesClient() {
  const [activeTab, setActiveTab] = useState<Tab>('departamentos')

  // ---- Departamentos ----
  const [deptData, setDeptData] = useState<DepartmentPayload | null>(null)
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
 const [loadingDepartamentos, setLoadingDepartamentos] = useState(false)
  const [deptMembers, setDeptMembers] = useState<DepartmentUser[]>([])
  const [loadingDeptMembers, setLoadingDeptMembers] = useState(false)
  const [searchDeptTerm, setSearchDeptTerm] = useState('')
  const [deptSearchResults, setDeptSearchResults] = useState<DepartmentUser[]>([])
  const [searchingDeptUsers, setSearchingDeptUsers] = useState(false)

  // ---- Usuários ----
  const [userSearchInput, setUserSearchInput] = useState('')
  const [userData, setUserData] = useState<UserPayload | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ---- Usuários por módulo (visualização) ----
  const [selectedModuleForLevels, setSelectedModuleForLevels] = useState<string>('')
  const [moduleLevelData, setModuleLevelData] = useState<ModuleLevelPayload | null>(null)
  const [loadingModuleLevels, setLoadingModuleLevels] = useState(false)
  const [bulkLevel, setBulkLevel] = useState<'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | 'REMOVER' | ''>('')

 // ---- Submódulos ----
  const [modulesForFeatures, setModulesForFeatures] = useState<ModuleDTO[]>([])
  const [selectedFeatureModuleKey, setSelectedFeatureModuleKey] = useState<string>('')
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('')
  const [featureData, setFeatureData] = useState<FeaturePayload | null>(null)
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [featureReloadKey, setFeatureReloadKey] = useState(0)

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
  useEffect(() => {
    if (!deptData) return
    if (modulesForFeatures.length > 0) return
    setModulesForFeatures(deptData.modules)
    if (!selectedFeatureModuleKey && deptData.modules.length > 0) {
      setSelectedFeatureModuleKey(deptData.modules[0].key)
    }
  }, [deptData, modulesForFeatures.length, selectedFeatureModuleKey])
  

  useEffect(() => {
    if (!selectedDeptId) {
      setDeptMembers([])
      setDeptSearchResults([])
      setSearchDeptTerm('')
      return
    }
    loadDepartmentMembers(selectedDeptId)
  }, [selectedDeptId])
  useEffect(() => {
    if (activeTab !== 'submodulos') return
    if (modulesForFeatures.length === 0) {
      const loadModules = async () => {
        try {
          setLoadingFeatures(true)
          const res = await fetch('/api/permissoes/departamentos', { cache: 'no-store' })
          if (!res.ok) {
            const json = await res.json().catch(() => ({}))
            throw new Error(json?.error || 'Erro ao carregar módulos.')
          }
          const json: DepartmentPayload = await res.json()
          setModulesForFeatures(json.modules)
          if (!selectedFeatureModuleKey && json.modules.length > 0) {
            setSelectedFeatureModuleKey(json.modules[0].key)
          }
        } catch (e: any) {
          setError(e?.message || 'Erro ao carregar módulos.')
        } finally {
          setLoadingFeatures(false)
        }
      }
      void loadModules()
      return
    }

    if (!selectedFeatureModuleKey && modulesForFeatures.length > 0) {
      setSelectedFeatureModuleKey(modulesForFeatures[0].key)
    }
  }, [activeTab, modulesForFeatures, selectedFeatureModuleKey])

  useEffect(() => {
    if (activeTab !== 'submodulos') return
    if (!selectedFeatureModuleKey) return

    const loadFeatures = async () => {
      try {
        setLoadingFeatures(true)
        setError(null)

        const params = new URLSearchParams({ moduleKey: selectedFeatureModuleKey })
        const res = await fetch(`/api/permissoes/features?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || 'Erro ao carregar submódulos.')
        }

        const json: FeaturePayload = await res.json()
        setFeatureData(json)
        if (!selectedFeatureId || !json.features.some((feature) => feature.id === selectedFeatureId)) {
          if (json.features.length > 0) {
            setSelectedFeatureId(json.features[0].id)
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar submódulos.')
      } finally {
        setLoadingFeatures(false)
      }
    }

    void loadFeatures()
  }, [activeTab, selectedFeatureModuleKey, featureReloadKey])

  useEffect(() => {
    if (!featureData?.features.length) return
    if (!selectedFeatureId || !featureData.features.some((feature) => feature.id === selectedFeatureId)) {
      setSelectedFeatureId(featureData.features[0].id)
    }
  }, [featureData, selectedFeatureId])

  // =========================
  // HANDLERS DEPARTAMENTOS
  // =========================
  const loadDepartmentMembers = async (departmentId: string) => {
    try {
      setLoadingDeptMembers(true)
      const params = new URLSearchParams({ departmentId })
      const res = await fetch(`/api/permissoes/departamentos/usuarios?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao carregar usuários do departamento.')
      }

      const json: DepartmentUser[] = await res.json()
      setDeptMembers(json.filter((user) => user.isMember))
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuários do departamento.')
    } finally {
      setLoadingDeptMembers(false)
    }
  }

  const searchUsersForDepartment = async () => {
    if (!selectedDeptId || !searchDeptTerm.trim()) return

    try {
      setSearchingDeptUsers(true)
      const params = new URLSearchParams({ search: searchDeptTerm.trim(), departmentId: selectedDeptId })
      const res = await fetch(`/api/permissoes/departamentos/usuarios?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao buscar usuários.')
      }

      const json: DepartmentUser[] = await res.json()
      setDeptSearchResults(json)
    } catch (e: any) {
      setError(e?.message || 'Erro ao buscar usuários.')
    } finally {
      setSearchingDeptUsers(false)
    }
  }

  const addUserToDepartment = async (userId: string) => {
    if (!selectedDeptId) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/departamentos/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: selectedDeptId, userId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao adicionar usuário ao departamento.')
      }

      await loadDepartmentMembers(selectedDeptId)
      await searchUsersForDepartment()
      setSuccess('Usuário adicionado ao departamento.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao adicionar usuário ao departamento.')
    } finally {
      setSaving(false)
    }
  }

  const removeUserFromDepartment = async (userId: string) => {
    if (!selectedDeptId) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const params = new URLSearchParams({ departmentId: selectedDeptId, userId })
      const res = await fetch(`/api/permissoes/departamentos/usuarios?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao remover usuário do departamento.')
      }

      await loadDepartmentMembers(selectedDeptId)
      setDeptSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isMember: false, isPrimary: false, canRemove: false } : u)),
      )
      setSuccess('Usuário removido do departamento.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao remover usuário do departamento.')
    } finally {
      setSaving(false)
    }
  }

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
    if (!userSearchInput.trim()) return

    try {
      setLoadingUser(true)
      setError(null)
      setSuccess(null)
      setUserData(null)

      const params = new URLSearchParams({ search: userSearchInput.trim() })
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

  const updateModuleLevelForUser = async (targetUser: ModuleLevelUser, level: UserModuleAccessDTO['level'] | null) => {
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
const updateModuleLevelInBulk = async () => {
    if (!moduleLevelData || !bulkLevel) return

    const userIds = moduleLevelData.users.map(({ user }) => user.id)
    if (userIds.length === 0) return

    const level = bulkLevel === 'REMOVER' ? null : bulkLevel
    const label = bulkLevel === 'REMOVER' ? 'sem acesso' : bulkLevel.replace('NIVEL_', 'nível ')

    if (!confirm(`Aplicar ${label} para ${userIds.length} usuário(s) deste módulo?`)) {
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/permissoes/modulos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: moduleLevelData.module.id,
          userIds,
          level,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao atualizar níveis em massa.')
      }

      setModuleLevelData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          users: prev.users.map((entry) => ({ ...entry, level })),
        }
      })

      setSuccess('Nível aplicado em massa.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar níveis em massa.')
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

       <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
        <div className="flex gap-2">
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
          <button
            type="button"
            className={`px-3 py-1 rounded-md text-sm ${
              activeTab === 'submodulos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}
            onClick={() => setActiveTab('submodulos')}
          >
            Submódulos
          </button>
        </div>

        {activeTab === 'departamentos' && moduleLevelData && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="rounded-md border px-3 py-2 text-xs"
              value={bulkLevel}
              onChange={(e) =>
                setBulkLevel(e.target.value as 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | 'REMOVER' | '')
              }
              disabled={saving}
            >
              <option value="">Aplicar nível em massa</option>
              <option value="NIVEL_1">Nível 1</option>
              <option value="NIVEL_2">Nível 2</option>
              <option value="NIVEL_3">Nível 3</option>
              <option value="REMOVER">Sem acesso</option>
            </select>
            <button
              type="button"
              className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
              onClick={updateModuleLevelInBulk}
              disabled={saving || !bulkLevel}
            >
              Aplicar em massa
            </button>
          </div>
        )}
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
               {/* BLOCO 1.5 - Usuários do departamento */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Usuários do departamento</p>
                    <p className="text-xs text-gray-500">
                      Busque pelo nome para adicionar usuários a este departamento.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      type="text"
                      className="w-full rounded-md border px-3 py-2 text-sm md:w-64"
                      placeholder="Digite o nome do usuário"
                      value={searchDeptTerm}
                      onChange={(e) => setSearchDeptTerm(e.target.value)}
                      disabled={!selectedDeptId || searchingDeptUsers}
                    />
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      onClick={searchUsersForDepartment}
                      disabled={!selectedDeptId || searchingDeptUsers || !searchDeptTerm.trim()}
                    >
                      {searchingDeptUsers ? 'Buscando...' : 'Buscar e adicionar'}
                    </button>
                  </div>
                </div>

                {deptSearchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">Resultados da busca</p>
                    <ul className="space-y-2">
                      {deptSearchResults.map((user) => (
                        <li
                          key={user.id}
                          className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-medium">{user.fullName}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {user.isPrimary && (
                              <div className="text-[11px] text-green-600">Departamento principal</div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            onClick={() => addUserToDepartment(user.id)}
                            disabled={saving || user.isMember}
                          >
                            {user.isMember ? 'Já adicionado' : 'Adicionar'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Membros atuais</p>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      onClick={() => selectedDeptId && loadDepartmentMembers(selectedDeptId)}
                      disabled={loadingDeptMembers || !selectedDeptId}
                    >
                      {loadingDeptMembers ? 'Atualizando...' : 'Recarregar'}
                    </button>
                  </div>

                  {loadingDeptMembers ? (
                    <p className="text-xs text-gray-500">Carregando usuários...</p>
                  ) : deptMembers.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhum usuário vinculado a este departamento.</p>
                  ) : (
                    <ul className="space-y-2">
                      {deptMembers.map((user) => (
                        <li
                          key={user.id}
                          className="flex flex-col gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-medium">{user.fullName}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {user.isPrimary && (
                              <div className="text-[11px] text-green-600">Departamento principal</div>
                            )}
                          </div>

                          {user.canRemove ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                              onClick={() => removeUserFromDepartment(user.id)}
                              disabled={saving}
                            >
                              Remover
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-500">Não é possível remover o principal.</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* BLOCO 2 (corrigido) */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Usuários por nível do módulo</p>
                    <p className="text-xs text-gray-500">
                      Selecione um módulo e clique no botão para ver quais usuários estão em cada nível.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-end">
                    {/* seletor de módulo */}
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
                     <div className="flex flex-col gap-3 rounded-md border bg-gray-50 px-3 py-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-medium">
                        {moduleLevelData.module.name}
                        {moduleLevelData.department ? (
                          <span className="text-xs font-normal text-gray-500">
                            {' '}
                            — {moduleLevelData.department.code} - {moduleLevelData.department.name}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <select
                          className="rounded-md border px-3 py-2 text-xs"
                          value={bulkLevel}
                          onChange={(e) =>
                            setBulkLevel(e.target.value as 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | 'REMOVER' | '')
                          }
                          disabled={saving}
                        >
                          <option value="">Aplicar nível em massa</option>
                          <option value="NIVEL_1">Nível 1</option>
                          <option value="NIVEL_2">Nível 2</option>
                          <option value="NIVEL_3">Nível 3</option>
                          <option value="REMOVER">Sem acesso</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                          onClick={updateModuleLevelInBulk}
                          disabled={saving || !bulkLevel}
                        >
                          Aplicar em massa
                        </button>
                      </div>
                    </div>

                    {moduleLevelData.users.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum usuário encontrado para os filtros selecionados.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Nome</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Nível 1</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Nível 2</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Nível 3</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {moduleLevelData.users.map(({ user, level }) => {
                              const radioName = `level-${user.id}`
                              return (
                                <tr key={user.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 align-top">
                                    <div className="font-medium text-gray-900">{user.fullName}</div>
                                    <div className="text-xs text-gray-600">{user.email}</div>
                                    <div className="text-xs text-gray-500">
                                      {user.department
                                        ? `${user.department.code} - ${user.department.name}`
                                        : 'Sem departamento'}
                                    </div>
                                    <button
                                      type="button"
                                      className="mt-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                                      disabled={saving}
                                      onClick={() => updateModuleLevelForUser(user, null)}
                                    >
                                      Remover acesso
                                    </button>
                                  </td>

                                  {(['NIVEL_1', 'NIVEL_2', 'NIVEL_3'] as const).map((option) => (
                                    <td key={option} className="px-3 py-2 text-center align-middle">
                                      <input
                                        type="radio"
                                        name={radioName}
                                        className="h-4 w-4"
                                        checked={level === option}
                                        disabled={saving}
                                        onChange={() => updateModuleLevelForUser(user, option)}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
              <label className="text-sm font-medium">Nome do usuário</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Digite o nome para buscar"
                value={userSearchInput}
                onChange={(e) => setUserSearchInput(e.target.value)}
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
                <p className="text-xs text-gray-500">Aqui você vincula o cadastro do usuário a um departamento oficial.</p>
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
        {activeTab === 'submodulos' && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Permissões por Submódulo</h2>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Módulo</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedFeatureModuleKey}
                onChange={(e) => {
                  setSelectedFeatureModuleKey(e.target.value)
                  setSelectedFeatureId('')
                  setFeatureData(null)
                }}
                disabled={loadingFeatures || modulesForFeatures.length === 0}
              >
                {modulesForFeatures.map((mod) => (
                  <option key={mod.id} value={mod.key}>
                    {mod.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Submódulo</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedFeatureId}
                onChange={(e) => setSelectedFeatureId(e.target.value)}
                disabled={loadingFeatures || !featureData?.features.length}
              >
                {featureData?.features.map((feature) => (
                  <option key={feature.id} value={feature.id}>
                    {feature.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingFeatures && <p className="text-sm text-gray-600">Carregando submódulos...</p>}

          {featureData && (
            <div className="rounded-md border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">
                  {featureData.module.name}
                  {selectedFeatureId &&
                    featureData.features.find((feature) => feature.id === selectedFeatureId) && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        •{' '}
                        {featureData.features.find((feature) => feature.id === selectedFeatureId)?.name}
                      </span>
                    )}
                </p>
                <p className="text-xs text-gray-500">{featureData.module.key}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Nível</th>
                      {(['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] satisfies FeatureAction[]).map((action) => (
                        <th key={action} className="px-3 py-2 text-center font-semibold text-gray-700">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {LEVELS.map((level) => {
                      const selectedFeature = featureData.features.find((feature) => feature.id === selectedFeatureId)
                      const currentActions =
                        featureData.levelGrants.find(
                          (grant) => grant.featureId === selectedFeatureId && grant.level === level.id,
                        )?.actions ?? []

                      const toggleAction = async (action: FeatureAction, enabled: boolean) => {
                        if (!selectedFeature) return
                        try {
                          setSaving(true)
                          setError(null)
                          setSuccess(null)

                          const nextActions = enabled
                            ? Array.from(new Set([...currentActions, action]))
                            : currentActions.filter((a) => a !== action)

                          setFeatureData((prev) => {
                            if (!prev) return prev
                            const nextGrants = prev.levelGrants.slice()
                            const existingIdx = nextGrants.findIndex(
                              (grant) => grant.featureId === selectedFeature.id && grant.level === level.id,
                            )
                            if (existingIdx >= 0) {
                              nextGrants[existingIdx] = {
                                ...nextGrants[existingIdx],
                                actions: nextActions,
                              }
                            } else {
                              nextGrants.push({
                                id: `${selectedFeature.id}-${level.id}`,
                                featureId: selectedFeature.id,
                                level: level.id,
                                actions: nextActions,
                              })
                            }

                            return { ...prev, levelGrants: nextGrants }
                          })

                          const res = await fetch('/api/permissoes/features', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              level: level.id,
                              featureKey: selectedFeature.key,
                              actions: nextActions,
                            }),
                          })

                          if (!res.ok) {
                            const json = await res.json().catch(() => ({}))
                            throw new Error(json?.error || 'Erro ao salvar permissões.')
                          }

                          setSuccess('Permissões atualizadas.')
                        } catch (e: any) {
                          setError(e?.message || 'Erro ao salvar permissões.')
                          // força reload na próxima iteração
                          setFeatureData(null)
                          setFeatureReloadKey((value) => value + 1)
                        } finally {
                          setSaving(false)
                        }
                      }

                      return (
                        <tr key={level.id}>
                          <td className="px-3 py-2 font-medium text-gray-900">{level.label}</td>
                          {(['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] satisfies FeatureAction[]).map(
                            (action) => (
                              <td key={action} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={currentActions.includes(action)}
                                  disabled={saving || !selectedFeatureId}
                                  onChange={(e) => toggleAction(action, e.target.checked)}
                                />
                              </td>
                            ),
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}