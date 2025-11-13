// src/app/dashboard/configuracoes/usuarios/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Save, PlusCircle, Pencil, Trash2, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'

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

// Rótulo “número - nome”
function ccLabel(cc: CostCenter) {
  const num = cc.externalCode || cc.code || ''
  return num ? `${num} - ${cc.description}` : cc.description
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
  // ------- criação -------
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [costCenterId, setCostCenterId] = useState('') // agora FK
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)
  const router = useRouter()
  const autoLogin = useMemo(() => toLoginFromName(fullName), [fullName])
  useEffect(() => setLogin(autoLogin), [autoLogin])

  // ------- listagem -------
  const [rows, setRows] = useState<UserRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // 👇 novo estado
  const [search, setSearch] = useState('')
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
  async function load() {
    setLoading(true)
    try {
      // usuários (Auth + Prisma)
      const r = await fetch('/api/configuracoes/usuarios', { cache: 'no-store' })
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}))
        throw new Error(err?.error || `GET falhou: ${r.status}`)
      }
      const list: UserRow[] = await r.json()
      setRows(list)

      // centros de custo (para selects)
      const cr = await fetch('/api/cost-centers/select', { cache: 'no-store' })
      if (!cr.ok) throw new Error(`GET /api/cost-centers/select -> ${cr.status}`)
      const arr: {
        id: string
        description: string
        code?: string | null
        externalCode?: string | null
      }[] = await cr.json()
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
    await load()
  }

  // ------- excluir -------
  async function handleDelete(u: UserRow) {
    if (!u.id) {
      alert('Este usuário não existe no banco (somente no Auth).')
      return
    }
    if (!confirm(`Excluir o usuário "${u.fullName}"?`)) return
    const r = await fetch(`/api/configuracoes/usuarios/${u.id}`, { method: 'DELETE' })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao excluir.')
      return
    }
    await load()
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="text-sm text-slate-400 mb-6">Sistema de Solicitações</div>

      {/* Título bem escuro */}
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
              placeholder=""
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
              <label className={LABEL}>Centro de Custo</label>
              <select
                className={INPUT}
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {ccLabel(cc)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Login (gerado automaticamente)</label>
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
                onChange={(e) => setFirstAccess(e.target.checked)}
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
       <div className="lg:col-span-8">


          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-100">
                Últimos usuários
              </div>

              <input
                type="search"
                className="ml-3 w-56 rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                placeholder="Buscar por nome, login, e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-[620px] overflow-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 table-header">
                  <tr className="text-left text-slate-400">
                    <th className="py-2 w-[28%]">Nome</th>
                    <th className="py-2 w-[16%]">Login</th>
                    <th className="py-2 w-[28%]">E-mail</th>
                    <th className="py-2 w-[16%]">Centro de Custo</th>
                    <th className="py-2 w-[12%] whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="py-6 text-slate-500" colSpan={5}>
                        Carregando…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td className="py-6 text-slate-500" colSpan={5}>
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((u) => (
                      <tr
                        key={u.id || u.email}
                        className="hover:bg-white/5 cursor-pointer"
                        onClick={() => router.push(`/dashboard/configuracoes/usuarios/${u.id}`)}
                      >
                        <td className="py-2 pr-3">
                          <td className="py-2 pr-3">{u.fullName}</td>
                        </td>



                        <td className="py-2 pr-3">{u.login}</td>
                        <td className="py-2 pr-3 break-all">{u.email}</td>
                        <td className="py-2 pr-3">{u.costCenterName || '—'}</td>

                        <td className="py-2">
                          <div className="flex items-center gap-2">

                            {/* Visualizar */}
                            <button
                              onClick={() => router.push(`/dashboard/configuracoes/usuarios/${u.id}`)}
                              className="btn-table"
                              disabled={!u.id}
                            >
                              <Eye size={14} /> Visualizar
                            </button>

                            {/* Editar */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(u)
                              }}
                              className="btn-table"
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
                              className="btn-table btn-table-danger"
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

            <p className="mt-2 text-[11px] text-slate-500">
              Dica: após criar, você pode usar esse usuário como solicitante nas
              telas.
            </p>
          </div>
        </div>
      </form>

      {/* MODAL DE EDIÇÃO */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar usuário</h3>
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
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>E-mail</label>
                <input
                  className={INPUT}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Login</label>
                <input
                  className={INPUT}
                  value={editLogin}
                  onChange={(e) => setEditLogin(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input
                  className={INPUT}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Centro de Custo</label>
                <select
                  className={INPUT}
                  value={editCostCenterId}
                  onChange={(e) => setEditCostCenterId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {ccLabel(cc)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Nova Senha (opcional)</label>
                <input
                  type="password"
                  className={INPUT}
                  placeholder="Deixe em branco para não alterar"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
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
