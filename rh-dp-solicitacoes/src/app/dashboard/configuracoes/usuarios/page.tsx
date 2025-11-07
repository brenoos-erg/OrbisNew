'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Save, PlusCircle, Pencil, Trash2, X, Check } from 'lucide-react'

type UserRow = {
  id: string
  fullName: string
  email: string
  login: string
  phone?: string | null
  costCenter?: string | null
}

const LABEL = 'block text-xs font-semibold text-black uppercase tracking-wide'
const INPUT =
  'mt-1 w-full rounded-md border border-blue-500/70 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150'

function toLoginFromName(fullName: string) {
  if (!fullName.trim()) return ''
  const parts = fullName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(/\s+/).filter(Boolean)
  const first = parts[0] || ''
  const last  = parts.length > 1 ? parts[parts.length - 1] : ''
  return [first, last].filter(Boolean).join('.').replace(/[^a-z.]/g, '')
}

export default function Page() {
  // ------- criação -------
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)

  const autoLogin = useMemo(() => toLoginFromName(fullName), [fullName])
  useEffect(() => setLogin(autoLogin), [autoLogin])

  // ------- listagem -------
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/configuracoes/usuarios', { cache: 'no-store' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error || `GET falhou: ${r.status}`)
      }
      const list: UserRow[] = await r.json()
      setRows(list || [])
    } catch (e) {
      console.error('load() error', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

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
          costCenter: costCenter.trim(),
          firstAccess,
          password,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({} as any))
        throw new Error(err?.error || `POST falhou: ${r.status}`)
      }
      setFullName(''); setEmail(''); setPhone(''); setCostCenter('')
      setLogin(''); setPassword(''); setFirstAccess(false)
      await load()
      alert('Usuário registrado com sucesso!')
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
  const [editCost, setEditCost] = useState('')
  const [editPassword, setEditPassword] = useState('')

  function openEdit(u: UserRow) {
    setEditing(u)
    setEditFullName(u.fullName)
    setEditEmail(u.email)
    setEditLogin(u.login)
    setEditPhone(u.phone || '')
    setEditCost(u.costCenter || '')
    setEditPassword('')
  }
  function closeEdit() { setEditing(null) }

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
        costCenter: editCost,
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
      <div className="text-sm text-slate-500 mb-6">Sistema de Solicitações</div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Configurações</h1>
      <p className="text-sm text-slate-500 mb-6">Cadastro e manutenção de usuários.</p>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <label className={LABEL}>Nome completo</label>
            <input className={INPUT} value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder=""/>
          </div>

          <div>
            <label className={LABEL}>E-mail</label>
            <input type="email" className={INPUT} value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email@empresa.com"/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Telefone</label>
              <input className={INPUT} value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="(31) 99999-0000"/>
            </div>
            <div>
              <label className={LABEL}>Centro de Custo</label>
              <input className={INPUT} value={costCenter} onChange={(e)=>setCostCenter(e.target.value)} placeholder="Ex.: TI"/>
            </div>
          </div>

          <div>
            <label className={LABEL}>Login (gerado automaticamente)</label>
            <input className={INPUT} value={login} onChange={(e)=>setLogin(e.target.value)} placeholder="breno.sousa"/>
            <p className="mt-1 text-[11px] text-slate-500">
              Padrão: primeiro nome + último sobrenome (sem acento), ex.: <b>breno.sousa</b>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha (opcional)</label>
              <input
                type="password"
                className={
                  'w-full rounded-lg border bg-white px-4 py-3 text-sm outline-none ' +
                  (firstAccess
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-slate-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-300')
                }
                placeholder="••••••••"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                disabled={firstAccess}
              />
            </div>
            <div className="flex items-center mt-6">
              <input id="firstAccess" type="checkbox" className="h-4 w-4 text-orange-600 border-gray-300 rounded"
                     checked={firstAccess} onChange={(e)=>setFirstAccess(e.target.checked)} />
              <label htmlFor="firstAccess" className="ml-2 text-sm text-slate-700">Usuário definirá a senha no primeiro acesso</label>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow disabled:opacity-60">
              <Save className="h-4 w-4" />
              {submitting ? 'Registrando…' : 'Registrar Usuário'}
            </button>
            <button type="button" onClick={load} disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              <PlusCircle className="h-4 w-4" />
              {loading ? 'Recarregando…' : 'Recarregar'}
            </button>
          </div>
        </div>

        {/* DIREITA */}
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-slate-200 bg-white/60 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Últimos usuários</div>

            <div className="max-h-[620px] overflow-auto overflow-x-auto">
                <table className="w-full text-sm">  {/* remove table-fixed */}
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 w-[34%]">Nome</th>
                    <th className="py-2 w-[18%]">Login</th>
                    <th className="py-2 w-[36%]">E-mail</th>
                    <th className="py-2 w-[12%] whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="py-6 text-slate-500" colSpan={4}>Carregando…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td className="py-6 text-slate-500" colSpan={4}>Nenhum usuário cadastrado.</td></tr>
                  ) : (
                    rows.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="py-2 pr-3">{u.fullName}</td>
                        <td className="py-2 pr-3">{u.login}</td>
                        <td className="py-2 pr-3 break-all">{u.email}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(u)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50" title="Editar">
                              <Pencil size={16}/> Editar
                            </button>
                            <button onClick={() => handleDelete(u)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 text-red-600" title="Excluir">
                              <Trash2 size={16}/> Excluir
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
              Dica: após criar, você pode usar esse usuário como solicitante nas telas.
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
              <button onClick={closeEdit} className="rounded-md p-1 hover:bg-slate-100"><X size={18}/></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LABEL}>Nome completo</label>
                <input className={INPUT} value={editFullName} onChange={(e)=>setEditFullName(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>E-mail</label>
                <input className={INPUT} value={editEmail} onChange={(e)=>setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Login</label>
                <input className={INPUT} value={editLogin} onChange={(e)=>setEditLogin(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input className={INPUT} value={editPhone} onChange={(e)=>setEditPhone(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Centro de Custo</label>
                <input className={INPUT} value={editCost} onChange={(e)=>setEditCost(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Nova Senha (opcional)</label>
                <input type="password" className={INPUT}
                       placeholder="Deixe em branco para não alterar"
                       value={editPassword} onChange={(e)=>setEditPassword(e.target.value)} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeEdit} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
                <X size={16}/> Cancelar
              </button>
              <button onClick={submitEdit}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Check size={16}/> Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
