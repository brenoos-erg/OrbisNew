'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  RefreshCw,
  ScanLine,
} from 'lucide-react'
import {
  TI_EQUIPMENT_CATEGORIES,
  type TiEquipmentCategory,
  type TiEquipmentStatus,
  getTiEquipmentCategoryLabel,
} from '@/lib/tiEquipment'

type EquipmentRow = {
  id: string
  name: string
  patrimonio: string
  serialNumber?: string | null
  value?: string | number | null
  category: TiEquipmentCategory
  status: TiEquipmentStatus
  observations?: string | null
  createdAt?: string
  updatedAt?: string
  user?: { id: string; fullName: string; email: string }
  costCenterSnapshot?: { id: string; description: string | null; externalCode: string | null; code: string | null }
}

type Counts = {
  total: number
  inStock: number
  assigned: number
  maintenance: number
  retired: number
}

type UserOption = {
  id: string
  fullName: string
  email: string
  costCenter?: { id: string; description: string | null; externalCode: string | null; code: string | null } | null
}
type CategoryFieldConfig = {
  label: string
  source: 'serialNumber' | 'observations'
  placeholder?: string
}


const INPUT =
  'mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300 shadow-sm transition-colors'

const categories: Array<{ value: TiEquipmentCategory | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  ...TI_EQUIPMENT_CATEGORIES,
]

const statusOptions: Array<{ value: TiEquipmentStatus; label: string }> = [
  { value: 'IN_STOCK', label: 'Em estoque' },
  { value: 'ASSIGNED', label: 'Em uso' },
  { value: 'MAINTENANCE', label: 'Em manutenção' },
  { value: 'RETIRED', label: 'Baixado' },
]
const categoryFieldConfig: Record<TiEquipmentCategory, CategoryFieldConfig> = {
  LINHA_TELEFONICA: {
    label: 'Número da linha',
    source: 'serialNumber',
    placeholder: 'Opcional',
  },
  SMARTPHONE: {
    label: 'IMEI',
    source: 'serialNumber',
    placeholder: 'Opcional',
  },
  NOTEBOOK: {
    label: 'Número de série',
    source: 'serialNumber',
    placeholder: 'Opcional',
  },
  DESKTOP: {
    label: 'Número de série',
    source: 'serialNumber',
    placeholder: 'Opcional',
  },
  MONITOR: {
    label: 'Tamanho',
    source: 'observations',
    placeholder: 'Opcional',
  },
  IMPRESSORA: {
    label: 'Local (se compartilhada)',
    source: 'observations',
    placeholder: 'Opcional',
  },
  TPLINK: {
    label: 'IP (se aplicável)',
    source: 'observations',
    placeholder: 'Opcional',
  },
  OUTROS: {
    label: 'Descrição curta',
    source: 'observations',
    placeholder: 'Opcional',
  },
}

const userLabelByCategory: Partial<Record<TiEquipmentCategory, string>> = {
  IMPRESSORA: 'Usuário (ou local)',
  TPLINK: 'Usuário (ou responsável)',
}



function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function formatCostCenter(
  cc?: { description: string | null; externalCode: string | null; code: string | null } | null,
) {
  if (!cc?.description && !cc?.externalCode && !cc?.code) return '—'
  const code = cc.externalCode || cc.code
  return code ? `${cc.description ?? ''} (${code})`.trim() : cc.description ?? '—'
}

function statusLabel(status: string) {
  const found = statusOptions.find((s) => s.value === status)
  return found?.label ?? status
}
function getUserLabel(category: TiEquipmentCategory) {
  return userLabelByCategory[category] ?? 'Usuário'
}

function getCategoryFieldConfig(category: TiEquipmentCategory) {
  return categoryFieldConfig[category]
}

type TiEquipmentsPanelProps = {
  initialCategory?: TiEquipmentCategory | 'ALL'
  lockCategory?: boolean
  title?: string
  subtitle?: string
  enableScanShortcut?: boolean
  shortcutMode?: boolean
}

export default function TiEquipmentsPanel({
  initialCategory = 'ALL',
  lockCategory = false,
  title = 'Controle de Equipamentos TI',
  subtitle = 'Inventário e status de equipamentos por categoria.',
  enableScanShortcut = false,
  shortcutMode = false,
}: TiEquipmentsPanelProps) {
  const defaultCategory: TiEquipmentCategory =
    initialCategory === 'ALL' ? 'NOTEBOOK' : initialCategory
  const [categoryFilter, setCategoryFilter] = useState<TiEquipmentCategory | 'ALL'>(
    initialCategory,
  )
  const [statusFilter, setStatusFilter] = useState<TiEquipmentStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    inStock: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<EquipmentRow | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [scanActive, setScanActive] = useState(enableScanShortcut && shortcutMode)
  const [scanInput, setScanInput] = useState('')
  const [scanValue, setScanValue] = useState('')
  const [scanMatch, setScanMatch] = useState<EquipmentRow | null>(null)
  const scanInputRef = useRef<HTMLInputElement | null>(null)

  const [formValues, setFormValues] = useState<{
    name: string
    patrimonio: string
    userId: string
    userLabel: string
    value: string
    serialNumber: string
    category: TiEquipmentCategory
    status: TiEquipmentStatus
    observations: string
    costCenterText: string
    costCenterMissing: boolean
  }>({
    name: '',
    patrimonio: '',
    userId: '',
    userLabel: '',
    value: '',
    serialNumber: '',
    category: defaultCategory,
    status: 'IN_STOCK',
    observations: '',
    costCenterText: '',
    costCenterMissing: false,
  })

  const [userSearch, setUserSearch] = useState('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const userSearchTimeout = useRef<NodeJS.Timeout | null>(null)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())

      const r = await fetch(`/api/ti/equipamentos?${params.toString()}`, { cache: 'no-store' })
      if (!r.ok) {
        throw new Error(`Falha ao buscar equipamentos (${r.status})`)
      }
      const data = await r.json()
      setRows(data.items ?? [])
      setTotal(data.total ?? 0)
      setCounts(
        data.counts ?? {
          total: 0,
          inStock: 0,
          assigned: 0,
          maintenance: 0,
          retired: 0,
        },
      )
      if (selected) {
        const refreshed = data.items?.find((item: EquipmentRow) => item.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Erro ao buscar equipamentos.')
      setRows([])
      setTotal(0)
      setCounts({ total: 0, inStock: 0, assigned: 0, maintenance: 0, retired: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!lockCategory) return
    setCategoryFilter(initialCategory)
  }, [initialCategory, lockCategory])
  useEffect(() => {
    if (!enableScanShortcut || !scanActive) return
    scanInputRef.current?.focus()
  }, [enableScanShortcut, scanActive])
  useEffect(() => {
    if (!shortcutMode) return
    scanInputRef.current?.focus()
  }, [shortcutMode])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter, search, page, pageSize])
useEffect(() => {
    if (!scanValue) {
      setScanMatch(null)
      return
    }
    const normalized = scanValue.trim().toLowerCase()
    const match =
      rows.find((row) => row.patrimonio?.trim().toLowerCase() === normalized) ?? null
    setScanMatch(match)
    if (match) setSelected(match)
  }, [rows, scanValue])
  function openCreate() {
    setEditing(null)
    setUserSearch('')
    setFormValues({
      name: '',
      patrimonio: '',
      userId: '',
      userLabel: '',
      value: '',
      serialNumber: '',
      category: categoryFilter === 'ALL' ? 'NOTEBOOK' : categoryFilter,
      status: 'IN_STOCK',
      observations: '',
      costCenterText: '',
      costCenterMissing: false,
    })
    setFormOpen(true)
    setFormError(null)
  }

  function openEdit(row: EquipmentRow) {
    setEditing(row)
    setUserSearch(row.user?.fullName || '')
    setFormValues({
      name: row.name || '',
      patrimonio: row.patrimonio || '',
      userId: row.user?.id || '',
      userLabel: row.user?.fullName || '',
      value: row.value ? String(row.value) : '',
      serialNumber: row.serialNumber || '',
      category: row.category,
      status: row.status,
      observations: row.observations || '',
      costCenterText: formatCostCenter(row.costCenterSnapshot),
      costCenterMissing: !row.costCenterSnapshot?.id,
    })
    setFormOpen(true)
    setFormError(null)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setFormError(null)
  }
function handleScanSubmit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setScanValue(trimmed)
    setSearch(trimmed)
    setPage(1)
    setSelected(null)
    setScanInput('')
  }
  function handleUserSelect(user: UserOption) {
    const ccText = formatCostCenter(user.costCenter || null)
    setFormValues((prev) => ({
      ...prev,
      userId: user.id,
      userLabel: user.fullName,
      costCenterText: ccText,
      costCenterMissing: !user.costCenter?.id,
    }))
    setUserSearch(user.fullName)
    setUserOptions([])
  }

  useEffect(() => {
    if (!userSearch) {
      setUserOptions([])
      return
    }

    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current)
    userSearchTimeout.current = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const r = await fetch(
          `/api/ti/equipamentos/users?search=${encodeURIComponent(userSearch)}`,
          { cache: 'no-store' },
        )
        if (!r.ok) {
          throw new Error('Erro ao buscar usuários.')
        }
        const data = await r.json()
        setUserOptions(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setUserOptions([])
      } finally {
        setSearchingUsers(false)
      }
    }, 300)

    return () => {
      if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current)
    }
  }, [userSearch])

  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!formValues.name.trim() || !formValues.patrimonio.trim() || !formValues.userId) {
      setFormError('Preencha nome, patrimônio e usuário.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formValues.name.trim(),
        patrimonio: formValues.patrimonio.trim(),
        userId: formValues.userId,
        value: formValues.value ? Number(formValues.value.replace(',', '.')) : null,
        serialNumber: formValues.serialNumber.trim() || null,
        category: lockCategory && categoryFilter !== 'ALL' ? categoryFilter : formValues.category,
        status: formValues.status,
        observations: formValues.observations.trim() || null,
      }

      const url = editing ? `/api/ti/equipamentos/${editing.id}` : '/api/ti/equipamentos'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao salvar.')
      }

      const data = await r.json().catch(() => ({}))
      if (data?.warning) {
        alert(data.warning)
      }

      closeForm()
      setSelected(null)
      load()
    } catch (err: any) {
      console.error(err)
      setFormError(err?.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: EquipmentRow) {
    if (!confirm(`Excluir o equipamento "${row.name}"?`)) return
    try {
      const r = await fetch(`/api/ti/equipamentos/${row.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao excluir.')
      }
      if (selected?.id === row.id) setSelected(null)
      load()
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir.')
    }
  }

  const currentCategoryLabel =
    categoryFilter === 'ALL'
      ? 'Todos'
      : getTiEquipmentCategoryLabel(categoryFilter) || categoryFilter

    const tableExtraLabel =
    categoryFilter === 'ALL'
      ? 'Identificação'
      : getCategoryFieldConfig(categoryFilter).label
      if (shortcutMode) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
          <button
            type="button"
            onClick={() => selected && openEdit(selected)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            disabled={!selected}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => selected && remove(selected)}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
            disabled={!selected}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Leitura rápida</h2>
            <button
              type="button"
              onClick={() => {
                setScanValue('')
                setScanMatch(null)
                setSearch('')
                setScanInput('')
                setSelected(null)
              }}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              Limpar
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Patrimônio (scanner)
              </label>
              <input
                ref={scanInputRef}
                className={INPUT}
                placeholder="Aguardando leitura do código..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleScanSubmit(scanInput)
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => handleScanSubmit(scanInput)}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <ScanLine className="h-4 w-4" />
              Buscar equipamento
            </button>
          </div>

          {scanValue && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-800">
                Última leitura: <span className="font-normal">{scanValue}</span>
              </div>
              {scanMatch ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span>
                    Equipamento encontrado: <strong>{scanMatch.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(scanMatch)}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar equipamento
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Nenhum equipamento encontrado com este patrimônio. Verifique a leitura e tente novamente.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Dados do equipamento</h2>
            {!selected ? (
              <p className="mt-3 text-sm text-slate-500">
                Faça a leitura para exibir os dados do equipamento.
              </p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <DetailRow label="Nome" value={selected.name} />
                <DetailRow label="Patrimônio" value={selected.patrimonio} />
                <DetailRow
                  label={getUserLabel(selected.category)}
                  value={selected.user?.fullName || '—'}
                />
                <DetailRow
                  label="Categoria"
                  value={getTiEquipmentCategoryLabel(selected.category) || selected.category}
                />
                <DetailRow label="Status" value={statusLabel(selected.status)} />
                <DetailRow
                  label={getCategoryFieldConfig(selected.category).label}
                  value={
                    getCategoryFieldConfig(selected.category).source === 'serialNumber'
                      ? selected.serialNumber || '—'
                      : selected.observations || '—'
                  }
                />
                <DetailRow label="Valor" value={formatCurrency(selected.value)} />
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Dados do usuário</h2>
            {!selected?.user ? (
              <p className="mt-3 text-sm text-slate-500">
                Selecione um equipamento para ver os dados do usuário.
              </p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <DetailRow label="Nome" value={selected.user.fullName} />
                <DetailRow label="Email" value={selected.user.email} />
                <DetailRow
                  label="Centro de custo"
                  value={formatCostCenter(selected.costCenterSnapshot)}
                />
              </div>
            )}
          </div>
        </div>

        {formOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {editing ? 'Editar equipamento' : 'Novo equipamento'}
                  </h3>
                  <p className="text-sm text-slate-500">Campos com * são obrigatórios.</p>
                </div>
                <button
                  onClick={closeForm}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
                onSubmit={saveForm}
              >
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Nome *
                  </label>
                  <input
                    className={INPUT}
                    value={formValues.name}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Patrimônio *
                  </label>
                  <input
                    className={INPUT}
                    value={formValues.patrimonio}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, patrimonio: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    {getUserLabel(formValues.category)} *
                  </label>
                  <div className="relative">
                    <input
                      className={INPUT}
                      value={userSearch || formValues.userLabel}
                      onChange={(e) => {
                        setUserSearch(e.target.value)
                        setFormValues((prev) => ({
                          ...prev,
                          userLabel: '',
                          userId: '',
                          costCenterText: '',
                          costCenterMissing: false,
                        }))
                      }}
                      placeholder="Digite para buscar..."
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />
                    )}
                    {userOptions.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
                        {userOptions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleUserSelect(user)}
                            className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-orange-50"
                          >
                            <span className="text-sm font-medium text-slate-800">
                              {user.fullName}
                            </span>
                            <span className="text-xs text-slate-500">{user.email}</span>
                            <span className="text-xs text-slate-600">
                              {formatCostCenter(user.costCenter || null)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {formValues.costCenterMissing && (
                    <p className="mt-1 text-xs text-amber-700">
                      Usuário sem centro de custo. Salvará como vazio.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Centro de custo (snapshot)
                  </label>
                  <input className={INPUT} value={formValues.costCenterText} readOnly />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Valor (R$)
                  </label>
                  <input
                    className={INPUT}
                    value={formValues.value}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, value: e.target.value }))
                    }
                    placeholder="Opcional"
                  />
                </div>

                {getCategoryFieldConfig(formValues.category).source === 'serialNumber' ? (
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">
                      {getCategoryFieldConfig(formValues.category).label}
                    </label>
                    <input
                      className={INPUT}
                      value={formValues.serialNumber}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, serialNumber: e.target.value }))
                      }
                      placeholder={getCategoryFieldConfig(formValues.category).placeholder}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">
                      {getCategoryFieldConfig(formValues.category).label}
                    </label>
                    <input
                      className={INPUT}
                      value={formValues.observations}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, observations: e.target.value }))
                      }
                      placeholder={getCategoryFieldConfig(formValues.category).placeholder}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Categoria *
                  </label>
                  <select
                    className={INPUT}
                    value={formValues.category}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        category: e.target.value as TiEquipmentCategory,
                      }))
                    }
                    disabled={lockCategory}
                  >
                    {categories
                      .filter((c) => c.value !== 'ALL')
                      .map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Status
                  </label>
                  <select
                    className={INPUT}
                    value={formValues.status}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        status: e.target.value as TiEquipmentStatus,
                      }))
                    }
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {getCategoryFieldConfig(formValues.category).source === 'serialNumber' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase text-slate-600">
                      Observações
                    </label>
                    <textarea
                      className={INPUT}
                      rows={3}
                      value={formValues.observations}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, observations: e.target.value }))
                      }
                      placeholder="Opcional"
                    />
                  </div>
                )}

                <div className="sm:col-span-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-md border px-4 py-2 text-sm"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        </div>
      </div>

      {/* Tabs de categorias */}
      {!lockCategory && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setCategoryFilter(cat.value)
                setPage(1)
              }}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <SummaryCard title={`Total (${currentCategoryLabel})`} value={counts.total} accent="bg-slate-800 text-white" />
        <SummaryCard title="Em estoque" value={counts.inStock} accent="bg-green-100 text-green-800" />
        <SummaryCard title="Em uso" value={counts.assigned} accent="bg-blue-100 text-blue-800" />
        <SummaryCard title="Em manutenção" value={counts.maintenance} accent="bg-amber-100 text-amber-800" />
        <SummaryCard title="Baixados" value={counts.retired} accent="bg-slate-100 text-slate-800" />
      </div>
      {enableScanShortcut && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Atalho de leitura rápida</h2>
              <p className="text-sm text-slate-500">
                Clique no botão para ativar a leitura e passe o patrimônio no leitor de código de barras.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScanActive((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  scanActive ? 'border-orange-200 bg-orange-50 text-orange-700' : ''
                }`}
              >
                <ScanLine className="h-4 w-4" />
                {scanActive ? 'Leitura ativa' : 'Ativar leitura'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanValue('')
                  setScanMatch(null)
                  setSearch('')
                  setScanInput('')
                  setSelected(null)
                }}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Patrimônio (scanner)
              </label>
              <input
                ref={scanInputRef}
                className={INPUT}
                placeholder="Aguardando leitura do código..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleScanSubmit(scanInput)
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => handleScanSubmit(scanInput)}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Buscar equipamento
            </button>
          </div>

          {scanValue && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-800">
                Última leitura: <span className="font-normal">{scanValue}</span>
              </div>
              {scanMatch ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span>
                    Equipamento encontrado: <strong>{scanMatch.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(scanMatch)}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar equipamento
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Nenhum equipamento encontrado com este patrimônio. Verifique a leitura e tente novamente.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-64 bg-transparent text-sm outline-none"
              placeholder="Buscar por nome, patrimônio, série, usuário..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as TiEquipmentStatus | '')
              setPage(1)
            }}
          >
            <option value="">Todos os status</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Linhas por página:</label>
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10))
              setPage(1)
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela + painel de detalhes */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-lg border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Patrimônio</th>
                  <th className="px-4 py-3">
                    {categoryFilter === 'ALL'
                      ? 'Usuário'
                      : getUserLabel(categoryFilter)}
                  </th>
                  <th className="px-4 py-3">Centro de custo</th>
                  <th className="px-4 py-3">{tableExtraLabel}</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Atualizado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      Nenhum equipamento encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t hover:bg-orange-50 cursor-pointer ${
                        selected?.id === row.id ? 'bg-orange-50' : ''
                      }`}
                      onClick={() => setSelected(row)}
                    >
                       <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-3">{row.patrimonio}</td>
                      <td className="px-4 py-3">{row.user?.fullName || '—'}</td>
                      <td className="px-4 py-3">{formatCostCenter(row.costCenterSnapshot)}</td>
                      <td className="px-4 py-3">
                        {getCategoryFieldConfig(row.category).source === 'serialNumber'
                          ? row.serialNumber || '—'
                          : row.observations || '—'}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(row.value)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(row)
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              remove(row)
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Página {page} de {totalPages} — {total} registro(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Detalhes</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-slate-500">
              Selecione um equipamento na tabela para ver os detalhes.
            </p>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <DetailRow label="Nome" value={selected.name} />
              <DetailRow label="Patrimônio" value={selected.patrimonio} />
              <DetailRow
                label={getUserLabel(selected.category)}
                value={selected.user?.fullName || '—'}
              />
              <DetailRow label="Centro de custo" value={formatCostCenter(selected.costCenterSnapshot)} />
              <DetailRow
                label="Categoria"
                value={getTiEquipmentCategoryLabel(selected.category) || selected.category}
              />
              <DetailRow label="Status" value={statusLabel(selected.status)} />
               <DetailRow
                label={getCategoryFieldConfig(selected.category).label}
                value={
                  getCategoryFieldConfig(selected.category).source === 'serialNumber'
                    ? selected.serialNumber || '—'
                    : selected.observations || '—'
                }
              />
              <DetailRow label="Valor" value={formatCurrency(selected.value)} />
              <DetailRow label="Atualizado em" value={formatDate(selected.updatedAt)} />
               {getCategoryFieldConfig(selected.category).source === 'serialNumber' && (
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Observações
                  </div>
                  <div className="mt-1 whitespace-pre-wrap rounded-md border bg-slate-50 px-3 py-2 text-slate-700">
                    {selected.observations || '—'}
                  </div>
                </div>
                 )}
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {editing ? 'Editar equipamento' : 'Novo equipamento'}
                </h3>
                <p className="text-sm text-slate-500">Campos com * são obrigatórios.</p>
              </div>
              <button
                onClick={closeForm}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={saveForm}>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Nome *
                </label>
                <input
                  className={INPUT}
                  value={formValues.name}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Patrimônio *
                </label>
                <input
                  className={INPUT}
                  value={formValues.patrimonio}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, patrimonio: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                   {getUserLabel(formValues.category)} *
                </label>
                <div className="relative">
                  <input
                    className={INPUT}
                    value={userSearch || formValues.userLabel}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setFormValues((prev) => ({
                        ...prev,
                        userLabel: '',
                        userId: '',
                        costCenterText: '',
                        costCenterMissing: false,
                      }))
                    }}
                    placeholder="Digite para buscar..."
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />
                  )}
                  {userOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
                      {userOptions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleUserSelect(user)}
                          className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-orange-50"
                        >
                          <span className="text-sm font-medium text-slate-800">
                            {user.fullName}
                          </span>
                          <span className="text-xs text-slate-500">{user.email}</span>
                          <span className="text-xs text-slate-600">
                            {formatCostCenter(user.costCenter || null)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formValues.costCenterMissing && (
                  <p className="mt-1 text-xs text-amber-700">
                    Usuário sem centro de custo. Salvará como vazio.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Centro de custo (snapshot)
                </label>
                <input className={INPUT} value={formValues.costCenterText} readOnly />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Valor (R$)
                </label>
                <input
                  className={INPUT}
                  value={formValues.value}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>

              {getCategoryFieldConfig(formValues.category).source === 'serialNumber' ? (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    {getCategoryFieldConfig(formValues.category).label}
                  </label>
                  <input
                    className={INPUT}
                    value={formValues.serialNumber}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, serialNumber: e.target.value }))
                    }
                    placeholder={getCategoryFieldConfig(formValues.category).placeholder}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    {getCategoryFieldConfig(formValues.category).label}
                  </label>
                  <input
                    className={INPUT}
                    value={formValues.observations}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, observations: e.target.value }))
                    }
                    placeholder={getCategoryFieldConfig(formValues.category).placeholder}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Categoria *
                </label>
                <select
                  className={INPUT}
                  value={formValues.category}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      category: e.target.value as TiEquipmentCategory,
                    }))
                  }
                  disabled={lockCategory}
                >
                  {categories
                    .filter((c) => c.value !== 'ALL')
                    .map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-600">
                  Status
                </label>
                <select
                  className={INPUT}
                  value={formValues.status}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      status: e.target.value as TiEquipmentStatus,
                    }))
                  }
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

               {getCategoryFieldConfig(formValues.category).source === 'serialNumber' && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Observações
                  </label>
                  <textarea
                    className={INPUT}
                    rows={3}
                    value={formValues.observations}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, observations: e.target.value }))
                    }
                    placeholder="Opcional"
                  />
                </div>
              )}

              <div className="sm:col-span-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border px-4 py-2 text-sm"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, accent }: { title: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase text-slate-500">{title}</p>
      <div className={`mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-lg font-semibold ${accent}`}>
        {value}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; className: string }
  > = {
    IN_STOCK: { label: 'Em estoque', className: 'bg-green-100 text-green-800' },
    ASSIGNED: { label: 'Em uso', className: 'bg-blue-100 text-blue-800' },
    MAINTENANCE: { label: 'Em manutenção', className: 'bg-amber-100 text-amber-800' },
    RETIRED: { label: 'Baixado', className: 'bg-slate-100 text-slate-800' },
  }

  const info = map[status] || { label: status, className: 'bg-slate-100 text-slate-800' }

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${info.className}`}>
      {info.label}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value || '—'}</div>
    </div>
  )
}