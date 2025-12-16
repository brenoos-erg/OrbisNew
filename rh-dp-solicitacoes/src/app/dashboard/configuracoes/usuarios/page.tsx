// src/app/dashboard/configuracoes/usuarios/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
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

type CostCenter = {
  id: string
  description: string
  code?: string | null
  externalCode?: string | null
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
        const text = `${cc.externalCode ?? ''} ${cc.code ?? ''} ${cc.description ?? ''
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

export default function Page() {
  const router = useRouter()

  // ------- criação -------
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [costCenterId, setCostCenterId] = useState('') // FK
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)

  const autoLogin = useMemo(() => toLoginFromName(fullName), [fullName])
  useEffect(() => setLogin(autoLogin), [autoLogin])

  // ------- listagem -------
  const [rows, setRows] = useState<UserRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // filtro de usuários
  const [search, setSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const usersPerPage = 5

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows

    return rows.filter((u) => {
      const costCenter = (u.costCenterName || '').toLowerCase()
      return (
        u.fullName.toLowerCase().includes(term) ||
        u.login.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        costCenter.includes(term)
      )
    })
  }, [rows, search])

  const totalUserPages = Math.max(1, Math.ceil(filteredRows.length / usersPerPage))
  const safeUserPage = Math.min(userPage, totalUserPages)
  const paginatedRows = useMemo(
    () =>
      filteredRows.slice(
        (safeUserPage - 1) * usersPerPage,
        safeUserPage * usersPerPage,
      ),
    [filteredRows, safeUserPage, usersPerPage],
  )
  const userPageStart = filteredRows.length === 0 ? 0 : (safeUserPage - 1) * usersPerPage + 1
  const userPageEnd = Math.min(filteredRows.length, safeUserPage * usersPerPage)

  useEffect(() => {
    setUserPage(1)
  }, [search])

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages || 1)
    }
  }, [userPage, totalUserPages])
  async function load() {
    setLoading(true)
    try {
      // usuários (Auth + Prisma)
      const r = await fetch('/api/configuracoes/usuarios', {
        cache: 'no-store',
      })
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}))
        throw new Error(err?.error || `GET falhou: ${r.status}`)
      }
      const list: UserRow[] = await r.json()
      setRows(list)

      // centros de custo (para selects / combos)
      const cr = await fetch('/api/cost-centers/select', {
        cache: 'no-store',
      })
      if (!cr.ok)
        throw new Error(
          `GET /api/cost-centers/select -> ${cr.status}`,
        )
      const arr: CostCenter[] = await cr.json()
      setCostCenters(arr)
    } catch (e) {
      console.error('load() error', e)
      setRows([])
      setCostCenters([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
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
          costCenterId: costCenterId || null,
          password: firstAccess ? '' : password,
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
      setCostCenterId('')
      setLogin('')
      setPassword('')
      setFirstAccess(false)
      await load()
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
    const r = await fetch(
      `/api/configuracoes/usuarios/${editing.id}`,
      {
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
      },
    )
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao atualizar.')
      return
    }
    closeEdit()
    await load()
  }

  // ------- excluir -------
  async function handleDelete(u: UserRow) {
    if (!u.id) {
      alert('Este usuário não existe no banco (somente no Auth).')
      return
    }
    if (!confirm(`Excluir o usuário "${u.fullName}"?`)) return
    const r = await fetch(
      `/api/configuracoes/usuarios/${u.id}`,
      {
        method: 'DELETE',
      },
    )
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao excluir.')
      return
    }
    await load()
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="text-sm text-slate-400 mb-6">
        Sistema de Solicitações
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
              <CostCenterCombo
                label="Centro de Custo"
                valueId={costCenterId}
                onChangeId={setCostCenterId}
                centers={costCenters}
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
                className={
                  'w-full rounded-lg border px-4 py-3 text-sm outline-none bg-[var(--card)] text-[var(--foreground)] ' +
                  (firstAccess
                    ? 'border-slate-500/50 text-slate-500 cursor-not-allowed'
                    : 'border-[var(--border-subtle)] focus:border-orange-400 focus:ring-2 focus:ring-orange-300')
                }
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={firstAccess}
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
              onClick={load}
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
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Tabela */}
<div className="mt-3 rounded-xl border border-slate-100 overflow-x-auto">
  <table className="w-full min-w-[1200px] text-sm table-fixed">
    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
      <tr>
        <th className="px-4 py-2 w-[20%] text-left">Nome</th>
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
      ) : filteredRows.length === 0 ? (
        <tr>
          <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
            Nenhum usuário encontrado.
          </td>
        </tr>
      ) : (
        paginatedRows.map((u) => (
          <tr
            key={u.id || u.email}
            className="hover:bg-slate-50/80 cursor-pointer transition-colors"
            onClick={() => {
              if (u.id) router.push(`/dashboard/configuracoes/usuarios/${u.id}`)
            }}
          >
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
        ))
      )}
    </tbody>
  </table>
</div>

{filteredRows.length > 0 && (
  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
    <p className="font-medium">
      Exibindo {userPageStart}-{userPageEnd} de {filteredRows.length} usuário(s)
    </p>

    <div className="flex items-center gap-2">
      <button
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
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={submitEdit}
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
