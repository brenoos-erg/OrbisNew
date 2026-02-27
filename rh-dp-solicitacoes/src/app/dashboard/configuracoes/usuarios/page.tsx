// src/app/dashboard/configuracoes/usuarios/page.tsx
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Save, PlusCircle, Pencil, Trash2, X, Check, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

type UserRow = {
  id: string
  fullName: string
  email: string
  login: string
  phone?: string | null
  costCenterId?: string | null
  costCenterName?: string | null
}

type UsersResponse = {
  items: UserRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type CostCenter = {
  id: string
  description: string
  code?: string | null
  externalCode?: string | null
}
type DepartmentOption = {
  id: string
  label: string
  description?: string | null
}


// labels mais escuros para melhor leitura no fundo claro
const LABEL =
  'block text-xs font-semibold uppercase tracking-wide text-slate-700'

const INPUT =
  'mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-[15px] shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300 transition-colors'

// Rótulo “cód externo - nome”
function ccLabel(cc: CostCenter) {
  // prioriza código externo, depois interno
  const num = cc.externalCode || cc.code || ''
  return num ? `${num} - ${cc.description}` : cc.description
}
function departmentLabel(dept: DepartmentOption) {
  return dept.description ? `${dept.description} - ${dept.label}` : dept.label
}

type DepartmentComboProps = {
  label: string
  valueId: string
  onChangeId: (id: string) => void
  departments: DepartmentOption[]
}

function DepartmentCombo({
  label,
  valueId,
  onChangeId,
  departments,
}: DepartmentComboProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const selected = departments.find((d) => d.id === valueId)
    setQuery(selected ? departmentLabel(selected) : '')
  }, [valueId, departments])

  const options = useMemo(
    () =>
      departments.filter((dept) => {
        const text = `${dept.description ?? ''} ${dept.label ?? ''}`.toLowerCase()
        return text.includes(query.toLowerCase())
      }),
    [departments, query],
  )

  function handleSelect(dept: DepartmentOption) {
    onChangeId(dept.id)
    setQuery(departmentLabel(dept))
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className={LABEL}>{label}</label>
      <input
        className={INPUT}
        placeholder="Digite código ou nome..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150)
        }}
      />

      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow">
          {options.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(dept)
              }}
            >
              {departmentLabel(dept)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Combobox de Centro de Custo (um campo só)
type CostCenterComboProps = {
  label: string
  valueId: string // id do centro selecionado
  onChangeId: (id: string) => void
  centers: CostCenter[]
}

function CostCenterCombo({
  label,
  valueId,
  onChangeId,
  centers,
}: CostCenterComboProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // sempre que mudar o id selecionado ou a lista, atualiza o texto do input
  useEffect(() => {
    const selected = centers.find((c) => c.id === valueId)
    setQuery(selected ? ccLabel(selected) : '')
  }, [valueId, centers])

  // filtra por código externo / interno / descrição
  const options = useMemo(
    () =>
      centers.filter((cc) => {
        const text = `${cc.externalCode ?? ''} ${cc.code ?? ''} ${
          cc.description ?? ''
        }`.toLowerCase()
        return text.includes(query.toLowerCase())
      }),
    [centers, query],
  )

  function handleSelect(cc: CostCenter) {
    onChangeId(cc.id)
    setQuery(ccLabel(cc))
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className={LABEL}>{label}</label>
      <input
        className={INPUT}
        placeholder="Digite código ou nome..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // dá tempo de clicar no item antes de fechar
          setTimeout(() => setOpen(false), 150)
        }}
      />

      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow">
          {options.map((cc) => (
            <button
              key={cc.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              onMouseDown={(e) => {
                e.preventDefault() // evita perder o foco antes de selecionar
                handleSelect(cc)
              }}
            >
              {ccLabel(cc)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Gera login a partir do nome
function toLoginFromName(fullName: string) {
  if (!fullName.trim()) return ''
  const parts = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const first = parts[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return [first, last].filter(Boolean).join('.').replace(/[^a-z.]/g, '')
}

// Gera e-mail automaticamente (primeiro nome + iniciais dos 2 últimos sobrenomes)
function toEmailFromName(fullName: string) {
  const parts = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return ''

  const firstName = parts[0].replace(/[^a-z]/g, '')
  const lastTwoInitials = parts
    .slice(1)
    .filter((p) => !['da', 'de', 'do', 'das', 'dos'].includes(p))
    .slice(-2)
    .map((p) => p.replace(/[^a-z]/g, ''))
    .filter(Boolean)
    .map((p) => p[0])
    .join('')

  const localPart = `${firstName}${lastTwoInitials}`.replace(/[^a-z]/g, '')
  if (!localPart) return ''

  return `${localPart}@ergengenharia.com.br`
}


export default function Page() {
  const router = useRouter()

  // ------- criação -------
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)

  const autoLogin = useMemo(() => toLoginFromName(fullName), [fullName])
  useEffect(() => setLogin(autoLogin), [autoLogin])

  const autoEmail = useMemo(() => toEmailFromName(fullName), [fullName])
  const lastAutoEmailRef = useRef('')
  useEffect(() => {
    setEmail((prev) => {
      const suggested = autoEmail
      const lastAuto = lastAutoEmailRef.current
      lastAutoEmailRef.current = suggested

      // Se o campo está vazio ou igual ao último sugerido, atualiza automaticamente
      if (!prev || prev === lastAuto) return suggested
      return prev
    })
  }, [autoEmail])


  // ------- listagem -------
  const [rows, setRows] = useState<UserRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [processingBulk, setProcessingBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkCreateFirstAccess, setBulkCreateFirstAccess] = useState(true)
  const [bulkCostCenterId, setBulkCostCenterId] = useState('')
  const [bulkDepartmentId, setBulkDepartmentId] = useState('')
  const [bulkResults, setBulkResults] = useState<
    {
      line: number
      name: string
      status: 'created' | 'existed' | 'synced' | 'failed'
      message: string
    }[]
  >([])

  // filtro de usuários
  const [search, setSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(20)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalUserPages, setTotalUserPages] = useState(1)

  // seleção em massa
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkPassword, setBulkPassword] = useState('')

  const safeUserPage = Math.min(userPage, totalUserPages)
  const userPageStart =
    totalUsers === 0 ? 0 : (safeUserPage - 1) * usersPerPage + 1
  const userPageEnd =
    totalUsers === 0
      ? 0
      : Math.min(totalUsers, userPageStart + rows.length - 1)

  const selectedCount = selectedIds.length
  const pageIds = rows.filter((u) => u.id).map((u) => u.id) as string[]
  const pageFullySelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  useEffect(() => {
    // se a lista mudou, limpa seleções inexistentes
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)))
  }, [rows])

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages || 1)
    }
  }, [userPage, totalUserPages])

  async function loadUsers() {
    setLoading(true)
    try {
      // usuários (Auth + Prisma)
      const qs = new URLSearchParams({
        page: String(userPage),
        pageSize: String(usersPerPage),
      })
      if (search.trim()) {
        qs.set('search', search.trim())
      }
      const r = await fetch(`/api/configuracoes/usuarios?${qs.toString()}`)
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}))
        throw new Error(err?.error || `GET falhou: ${r.status}`)
      }
       const payload = (await r.json()) as UsersResponse
      setRows(payload.items)
      setTotalUsers(payload.total)
      setTotalUserPages(payload.totalPages)
      setUserPage(payload.page)
      setUsersPerPage(payload.pageSize)
    } catch (e) {
      console.error('loadUsers() error', e)
      setRows([])
      setTotalUsers(0)
      setTotalUserPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [userPage, usersPerPage, search])

  useEffect(() => {
    let active = true
    const loadCostCenters = async () => {
      try {
        const cr = await fetch('/api/cost-centers/select')
        if (!cr.ok) throw new Error(`GET /api/cost-centers/select -> ${cr.status}`)
        const arr: CostCenter[] = await cr.json()
        if (active) setCostCenters(arr)
      } catch (e) {
        console.error('loadCostCenters() error', e)
        if (active) setCostCenters([])
      }
    }

    loadCostCenters()
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true

    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/departments', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/departments -> ${res.status}`)
        const arr: DepartmentOption[] = await res.json()
        if (active) setDepartments(arr)
      } catch (e) {
        console.error('loadDepartments() error', e)
        if (active) setDepartments([])
      }
    }

    loadDepartments()
    return () => {
      active = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !email || !login) {
      alert('Preencha Nome, E-mail e Login.')
      return
    }
    try {
      setSubmitting(true)
      const r = await fetch('/api/configuracoes/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            login: login.trim().toLowerCase(),
            phone: phone.trim(),
            departmentId: departmentId || null,
          password,
            firstAccess,
          }),
        })
      if (!r.ok) {
        const err = await r.json().catch(() => ({} as any))
        throw new Error(err?.error || `POST falhou: ${r.status}`)
      }
      setFullName('')
      setEmail('')
      setPhone('')
      setDepartmentId('')
      setLogin('')
      setPassword('')
      setFirstAccess(false)
      await loadUsers()
      alert('Usuário criado com sucesso!')
    } catch (e: any) {
      console.error('onSubmit error', e)
      alert(e?.message || 'Erro ao registrar usuário.')
    } finally {
      setSubmitting(false)
    }
  }


  // ------- edição -------
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLogin, setEditLogin] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCostCenterId, setEditCostCenterId] = useState('')
  const [editPassword, setEditPassword] = useState('')

  function openEdit(u: UserRow) {
    setEditing(u)
    setEditFullName(u.fullName)
    setEditEmail(u.email)
    setEditLogin(u.login)
    setEditPhone(u.phone || '')
    setEditCostCenterId(u.costCenterId || '')
    setEditPassword('')
  }

  function closeEdit() {
    setEditing(null)
  }

  async function submitEdit() {
    if (!editing) return
    const r = await fetch(`/api/configuracoes/usuarios/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: editFullName,
        email: editEmail,
        login: editLogin,
        phone: editPhone,
        costCenterId: editCostCenterId || null,
        password: editPassword || undefined,
      }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao atualizar.')
      return
    }
    closeEdit()
    await loadUsers()
  }

  function toggleSelection(id?: string) {
    if (!id) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  function toggleSelectAllPage() {
    if (pageIds.length === 0) return
    if (pageFullySelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`Excluir ${selectedIds.length} usuário(s)?`)) return

    setProcessingBulk(true)
    try {
      for (const id of selectedIds) {
        const r = await fetch(`/api/configuracoes/usuarios/${id}`, {
          method: 'DELETE',
        })
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err?.error || 'Falha ao excluir um dos usuários.')
        }
      }
       setSelectedIds([])
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'Erro ao excluir selecionados.')
    } finally {
      setProcessingBulk(false)
    }
  }

  async function handleBulkPassword() {
    if (selectedIds.length === 0) return
    const trimmed = bulkPassword.trim()
    if (!trimmed) {
      alert('Informe a nova senha para os usuários selecionados.')
      return
    }

    setProcessingBulk(true)
    try {
      for (const id of selectedIds) {
        const r = await fetch(`/api/configuracoes/usuarios/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: trimmed }),
        })
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err?.error || 'Falha ao atualizar senha de um usuário.')
        }
      }
      setBulkPassword('')
      setSelectedIds([])
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'Erro ao atualizar senhas.')
    } finally {
      setProcessingBulk(false)
    }
  }

  // ✅ AJUSTE 2: bulk não exige email; se vier vazio, gera automaticamente
  async function handleBulkCreate() {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      alert('Cole ou digite pelo menos uma linha para cadastro em massa.')
      return
    }

    setBulkResults([])
    setBulkCreating(true)

    const results: {
      line: number
      name: string
      status: 'created' | 'existed' | 'synced' | 'failed'
      message: string
    }[] = []

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const parts = raw.split(';').map((p) => p.trim())
      const [name, emailInput, phoneInput, passwordInput, loginInput] = parts

      if (!name) {
        results.push({
          line: i + 1,
          name: name || '—',
          status: 'failed',
          message: 'Nome é obrigatório.',
        })
        continue
      }

       const loginValue = (loginInput || toLoginFromName(name)).toLowerCase()
      const emailValue =
        (emailInput && emailInput.toLowerCase()) || toEmailFromName(name)

      const passwordValue = (passwordInput || '').trim()

       try {
        const r = await fetch('/api/configuracoes/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: name,
            email: emailValue,
            login: loginValue,
            phone: phoneInput || '',
            costCenterId: bulkCostCenterId || null,
             departmentId: bulkDepartmentId || null,
            password: passwordValue,
            firstAccess: bulkCreateFirstAccess,
          }),
        })

        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err?.error || `Falha ao criar (status ${r.status}).`)
        }
         const payload = await r
          .json()
          .catch(() => ({ status: 'created', message: 'Criado com sucesso' }))

        const normalizedStatus: 'created' | 'existed' | 'synced' =
          payload?.status === 'existed' || payload?.status === 'synced'
            ? payload.status
            : 'created'


        results.push({
          line: i + 1,
          name,
          status: normalizedStatus,
          message:
            payload?.message ||
            (normalizedStatus === 'existed'
              ? 'Usuário já existia, sincronizado.'
              : 'Criado com sucesso'),
        })
      } catch (e: any) {
        results.push({
          line: i + 1,
          name,
          status: 'failed',
          message: e?.message || 'Erro inesperado ao criar.',
        })
      }
    }

    setBulkResults(results)
    setBulkCreating(false)

    if (results.length > 0 && results.every((r) => r.status !== 'failed')) {
      setBulkText('')
      await loadUsers()
    }
  }

  // ------- excluir -------
  async function handleDelete(u: UserRow) {
    if (!u.id) {
      alert('Este usuário não existe no banco (somente no Auth).')
      return
    }
    if (!confirm(`Excluir o usuário "${u.fullName}"?`)) return
    const r = await fetch(`/api/configuracoes/usuarios/${u.id}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao excluir.')
      return
    }
    await loadUsers()
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="text-sm text-slate-400 mb-6">
        Sistema de Gestão Integrada
      </div>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">
        Configurações
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Cadastro e manutenção de usuários.
      </p>

      <form
        onSubmit={onSubmit}
        autoComplete="off"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* HONEYPOTS */}
        <input
          type="text"
          name="email"
          autoComplete="email"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />

        {/* ESQUERDA */}
        <div className="lg:col-span-4">
          <div>
            <label className={LABEL}>Nome completo</label>
            <input
              className={INPUT}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL}>E-mail</label>
            <input
              type="email"
              id="userEmail"
              name="manual_email"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              className={INPUT}
              placeholder="email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Telefone</label>
              <input
                className={INPUT}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(31) 99999-0000"
              />
            </div>

            <div>
              <DepartmentCombo
                label="Departamento"
                valueId={departmentId}
                onChangeId={setDepartmentId}
                departments={departments}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>
              Login (gerado automaticamente)
            </label>
            <input
              className={INPUT}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="breno.sousa"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Padrão: primeiro nome + último sobrenome (sem acento), ex.:{' '}
              <b>breno.sousa</b>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Senha (opcional)
              </label>
              <input
                type="password"
                id="userPassword"
                name="manual_password"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                 className="w-full rounded-lg border px-4 py-3 text-sm outline-none bg-[var(--card)] text-[var(--foreground)] border-[var(--border-subtle)] focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                id="firstAccess"
                type="checkbox"
                className="h-4 w-4 text-orange-600 border-gray-300 rounded"
                checked={firstAccess}
                onChange={(e) =>
                  setFirstAccess(e.target.checked)
                }
              />
              <label
                htmlFor="firstAccess"
                className="ml-2 text-sm"
                style={{ color: 'var(--foreground)' }}
              >
                Usuário definirá a senha no primeiro acesso
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
               {submitting ? 'Registrando…' : 'Registrar Usuário'}
            </button>
            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <PlusCircle className="h-4 w-4" />
              {loading ? 'Recarregando…' : 'Recarregar'}
            </button>
          </div>
        </div>

        {/* DIREITA */}
        {/* DIREITA */}
        <div className="lg:col-span-8">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm p-4">
            {/* Cabeçalho da lista */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Últimos usuários
                </h2>
                <p className="text-xs text-slate-500">
                  Visualize, filtre e gerencie os usuários já cadastrados.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="search"
                  className="w-full sm:w-64 rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  placeholder="Buscar por nome, login, e-mail..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setUserPage(1)
                  }}
                />
              </div>
            </div>
            
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">
                  Selecionados: {selectedCount}
                </span>
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-orange-600 underline hover:text-orange-700"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    className="w-48 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Nova senha em massa"
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={processingBulk || selectedCount === 0}
                    onClick={handleBulkPassword}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Aplicar senha
                  </button>
                </div>

                <button
                  type="button"
                  disabled={processingBulk || selectedCount === 0}
                  onClick={handleBulkDelete}
                  className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Excluir selecionados
                </button>
              </div>
            </div>

            {/* Tabela */}
<div className="mt-3 rounded-xl border border-slate-100 overflow-x-auto">
  <table className="w-full min-w-[1200px] text-sm table-fixed">
    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
      <tr>
         <th className="px-4 py-2 w-10 text-left">
          <input
            type="checkbox"
            checked={pageFullySelected}
            onChange={toggleSelectAllPage}
            className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
          />
        </th>
        <th className="px-4 py-2 w-[19%] text-left">Nome</th>
        <th className="px-4 py-2 w-[14%] text-left">Login</th>
        <th className="px-4 py-2 w-[25%] text-left">E-mail</th>
        <th className="px-4 py-2 w-[18%] text-left">Centro de Custo</th>
        <th className="px-4 py-2 w-[15%] text-right whitespace-nowrap">Ações</th>
      </tr>
    </thead>

    <tbody className="divide-y divide-slate-100">
      {loading ? (
        <tr>
          <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
            Carregando…
          </td>
        </tr>
       ) : rows.length === 0 ? (
        <tr>
          <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
            Nenhum usuário encontrado.
          </td>
        </tr>
      ) : (
        rows.map((u) => {
          const isSelected = !!u.id && selectedIds.includes(u.id)
          return (
          <tr
            key={u.id || u.email}
            className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
              isSelected ? 'bg-orange-50/70' : ''
            }`}
            onClick={() => {
              if (u.id) router.push(`/dashboard/configuracoes/usuarios/${u.id}`)
            }}
          >
            <td className="px-4 py-2 align-top">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelection(u.id)}
                disabled={!u.id}
              />
            </td>
            <td className="px-4 py-2 align-top">
              <div className="font-medium text-slate-900 truncate" title={u.fullName}>
                {u.fullName}
              </div>
              <div className="text-[11px] text-slate-500 whitespace-nowrap">
                criado recentemente
              </div>
            </td>

            <td className="px-4 py-2 text-slate-700 truncate" title={u.login}>
              {u.login}
            </td>

            <td className="px-4 py-2 text-slate-700 truncate" title={u.email}>
              {u.email}
            </td>

            <td className="px-4 py-2">
              <span
                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 max-w-[11rem] truncate"
                title={u.costCenterName || '—'}
              >
                {u.costCenterName || '—'}
              </span>
            </td>

            <td className="px-4 py-2 pl-6">
              <div className="flex items-center justify-end gap-1">
                {/* Visualizar */}
                <button
                type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (u.id) router.push(`/dashboard/configuracoes/usuarios/${u.id}`)
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                  disabled={!u.id}
                >
                  <Eye size={14} /> Ver
                </button>

                {/* Editar */}
                <button
                 type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(u)
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                  disabled={!u.id}
                  title="Editar"
                >
                  <Pencil size={14} /> Editar
                </button>

                {/* Excluir */}
                <button
                 type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(u)
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
                  disabled={!u.id}
                  title="Excluir"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </td>
          </tr>
          )
        })
      )}
    </tbody>
  </table>
</div>

{totalUsers > 0 && (
  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
    <p className="font-medium">
      Exibindo {userPageStart}-{userPageEnd} de {totalUsers} usuário(s)
    </p>

    <div className="flex items-center gap-2">
      <button
      type="button"
        onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
        disabled={safeUserPage === 1}
        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        Anterior
      </button>

      <span className="text-xs uppercase text-slate-500">
        Página {safeUserPage} / {totalUserPages}
      </span>

      <button
      type="button"
        onClick={() => setUserPage((prev) => Math.min(totalUserPages, prev + 1))}
        disabled={safeUserPage === totalUserPages}
        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        Próxima
      </button>
    </div>
  </div>
)}

<p className="mt-3 text-[11px] text-slate-500">
Dica: após criar, você pode usar esse usuário como solicitante nas telas.
        </p>

          </section>
        </div>
        <div className="lg:col-span-12">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Cadastro em massa</h2>
                <p className="text-xs text-slate-500">
                  Cole várias linhas usando ponto e vírgula como separador e cadastre tudo de uma só vez.
                </p>
               <p className="mt-1 text-[11px] text-slate-500">
                  Formato: Nome completo; email; telefone (opcional); senha (opcional); login (opcional).
                  Se o login estiver vazio, usamos o padrão gerado pelo nome (primeiro e último).
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end sm:w-80 w-full">
               <CostCenterCombo
                  label="Centro de custo (opcional)"
                  valueId={bulkCostCenterId}
                  onChangeId={setBulkCostCenterId}
                  centers={costCenters}
                />
                <p className="-mt-1 text-[11px] text-slate-500">
                  Aplicado a todos os usuários criados nesta lista.
                </p>

               <DepartmentCombo
                  label="Departamento (opcional)"
                  valueId={bulkDepartmentId}
                  onChangeId={setBulkDepartmentId}
                  departments={departments}
                />
                <p className="-mt-1 text-[11px] text-slate-500">
                  Aplicado a todos os usuários criados nesta lista.
                </p>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                    checked={bulkCreateFirstAccess}
                    onChange={(e) => setBulkCreateFirstAccess(e.target.checked)}
                  />
                  Usuário definirá a senha no primeiro acesso
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() =>
                    setBulkText(
                        'Maria Silva; maria.silva@empresa.com; (31) 99999-0000; ; maria.silva\n' +
                          'João Souza; joao.souza@empresa.com; ; SenhaSegura123; joao.souza',
                    )
                  }
                >
                  Preencher exemplo
                </button>
                  <button
                    type="button"
                    disabled={bulkCreating}
                    onClick={handleBulkCreate}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {bulkCreating ? 'Processando…' : 'Registrar em massa'}
                  </button>
                </div>
              </div>
            </div>

            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white/80 p-3 text-sm text-slate-800 shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
              rows={4}
              placeholder={
                'Exemplo:\nMaria Silva; maria.silva@empresa.com; (31) 99999-0000; ; maria.silva\nJoão Souza; joao.souza@empresa.com; ; SenhaSegura123; joao.souza'
              }
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />

            {bulkResults.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white/60 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Resultados do processamento:</p>
                <ul className="mt-2 space-y-1">
                  {bulkResults.map((r) => (
                    <li key={r.line} className="flex items-center justify-between gap-2">
                      <span>
                        Linha {r.line}: <b>{r.name}</b>
                      </span>
                      <span
                        className={
                          r.status === 'failed'
                            ? 'text-red-700'
                            : 'text-green-700'
                        }
                      >
                        {r.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

      </form>


      {/* MODAL DE EDIÇÃO */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Editar usuário
              </h3>
              <button
                onClick={closeEdit}
                type="button"
                className="rounded-md p-1 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LABEL}>Nome completo</label>
                <input
                  className={INPUT}
                  value={editFullName}
                  onChange={(e) =>
                    setEditFullName(e.target.value)
                  }
                />
              </div>
              <div>
                <label className={LABEL}>E-mail</label>
                <input
                  className={INPUT}
                  value={editEmail}
                  onChange={(e) =>
                    setEditEmail(e.target.value)
                  }
                />
              </div>
              <div>
                <label className={LABEL}>Login</label>
                <input
                  className={INPUT}
                  value={editLogin}
                  onChange={(e) =>
                    setEditLogin(e.target.value)
                  }
                />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input
                  className={INPUT}
                  value={editPhone}
                  onChange={(e) =>
                    setEditPhone(e.target.value)
                  }
                />
              </div>
              <div>
                <CostCenterCombo
                  label="Centro de Custo"
                  valueId={editCostCenterId}
                  onChangeId={setEditCostCenterId}
                  centers={costCenters}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>
                  Nova Senha (opcional)
                </label>
                <input
                  type="password"
                  className={INPUT}
                  placeholder="Deixe em branco para não alterar"
                  value={editPassword}
                  onChange={(e) =>
                    setEditPassword(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeEdit}
                type="button"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={submitEdit}
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Check size={16} /> Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
