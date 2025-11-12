'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Users, Shield } from 'lucide-react'

type Group = { id: string; name: string; notes?: string | null; _count?: { members: number; grants: number } }
type UserLite = { id: string; fullName: string; email: string; login?: string | null }
type Grant = { module: { key: string; name: string }; actions: string[] }

export default function Permissoes() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [members, setMembers] = useState<UserLite[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [allUsers, setAllUsers] = useState<UserLite[]>([])
  const [newMember, setNewMember] = useState('')

  async function loadGroups() {
    const r = await fetch('/api/access-groups', { cache: 'no-store' })
    setGroups(await r.json())
  }

  async function openGroup(id: string) {
    const r = await fetch(`/api/access-groups/${id}`, { cache: 'no-store' })
    const g = await r.json()
    setSelected(g)
    setMembers(g.members.map((m: any) => m.user))
    setGrants(g.grants.map((gr: any) => ({ module: gr.module, actions: gr.actions })))
    const ur = await fetch('/api/configuracoes/usuarios', { cache: 'no-store' })
    setAllUsers(await ur.json())
  }

  async function createGroup() {
    const name = prompt('Nome do grupo:')
    if (!name) return
    await fetch('/api/access-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    await loadGroups()
  }

  async function addMember() {
    if (!newMember) return
    await fetch(`/api/access-groups/${selected.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newMember }),
    })
    setNewMember('')
    await openGroup(selected.id)
  }

  async function removeMember(userId: string) {
    await fetch(`/api/access-groups/${selected.id}/members?userId=${userId}`, { method: 'DELETE' })
    await openGroup(selected.id)
  }

  function hasAction(a: string) {
    return grants.find((g) => g.module.key === 'solicitacoes')?.actions.includes(a)
  }

  async function toggleAction(a: string) {
    const g = grants.find((x) => x.module.key === 'solicitacoes')
    const next = g ? [...g.actions] : []
    const i = next.indexOf(a)
    if (i >= 0) next.splice(i, 1)
    else next.push(a)

    await fetch(`/api/access-groups/${selected.id}/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleKey: 'solicitacoes', actions: next }),
    })
    await openGroup(selected.id)
  }

  useEffect(() => { loadGroups() }, [])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-sm text-slate-500 mb-6">Sistema de Solicitações</div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Grupos de Acesso</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border bg-white/60 p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold text-slate-700">Grupos</div>
            <button onClick={createGroup} className="inline-flex items-center gap-2 border px-3 py-1 rounded hover:bg-slate-50"><Plus size={14}/>Novo</button>
          </div>
          {groups.map(g => (
            <div key={g.id} className="py-2 flex items-center justify-between border-b">
              <button onClick={() => openGroup(g.id)} className="text-left hover:underline">
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-slate-500">{g._count?.members} membros • {g._count?.grants} permissões</div>
              </button>
              <button onClick={async()=>{if(confirm('Excluir?')){await fetch(`/api/access-groups/${g.id}`,{method:'DELETE'}); await loadGroups()}}} className="text-red-600 border px-2 py-1 rounded hover:bg-slate-50"><Trash2 size={14}/></button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-7 rounded-xl border bg-white/60 p-4">
          {!selected ? (
            <div className="text-sm text-slate-500">Selecione um grupo para editar.</div>
          ) : (
            <>
              <div className="mb-4 font-semibold">{selected.name}</div>
              <div className="border rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3"><Shield size={16}/>Permissões: <b>Solicitações</b></div>
                <div className="flex flex-wrap gap-2">
                  {['VIEW','CREATE','UPDATE','DELETE','APPROVE'].map(a => (
                    <button key={a} onClick={()=>toggleAction(a)}
                      className={`border px-3 py-1 rounded text-sm ${hasAction(a) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'hover:bg-slate-50'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3"><Users size={16}/>Membros</div>
                <div className="flex gap-2 mb-3">
                  <select className="border rounded px-3 py-2 text-sm flex-1" value={newMember} onChange={e=>setNewMember(e.target.value)}>
                    <option value="">Selecionar usuário…</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                  <button onClick={addMember} className="border px-3 py-2 rounded text-sm hover:bg-slate-50">Adicionar</button>
                </div>
                {members.length === 0 ? <div className="text-sm text-slate-500">Nenhum membro.</div> : (
                  <table className="w-full text-sm">
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-t">
                          <td className="py-2 pr-3">{m.fullName}</td>
                          <td className="py-2 pr-3">{m.login}</td>
                          <td className="py-2 text-right">
                            <button onClick={()=>removeMember(m.id)} className="text-red-600 border px-2 py-1 rounded hover:bg-slate-50"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
