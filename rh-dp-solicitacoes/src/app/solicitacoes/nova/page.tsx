'use client' // habilita componentes client-side
import { useEffect, useState } from 'react'


export default function NovaSolicitacaoPage() {
const [tipos, setTipos] = useState<any[]>([]) // estado para lista de tipos
const [form, setForm] = useState({ // estado do formulário
titulo: '', descricao: '', setorDestino: 'RH', tipoId: '', autorId: 'meu-user-id-temp'
})
const [extras, setExtras] = useState<Record<string, any>>({}) // campos dinâmicos


// Carrega tipos na montagem
useEffect(() => { fetch('/api/tipos').then(r=>r.json()).then(setTipos) }, [])


// Atualiza campos controlados
const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
setForm({ ...form, [e.target.name]: e.target.value })
}


// Envio do formulário
const onSubmit = async (e: React.FormEvent) => {
e.preventDefault()
await fetch('/api/solicitacoes', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ ...form, payload: extras })
})
window.location.href = '/solicitacoes'
}


const tipoSelecionado = tipos.find(t => t.id === form.tipoId)


return (
<div className="max-w-2xl">
<h1 className="text-xl font-semibold mb-4">Nova Solicitação</h1>
<form onSubmit={onSubmit} className="space-y-3">
<input name="titulo" className="w-full border p-2 rounded" placeholder="Título" value={form.titulo} onChange={onChange} />
<textarea name="descricao" className="w-full border p-2 rounded" placeholder="Descreva a necessidade" value={form.descricao} onChange={onChange} />
<select name="setorDestino" className="w-full border p-2 rounded" value={form.setorDestino} onChange={onChange}>
<option value="RH">RH</option>
<option value="DP">DP</option>
</select>
<select name="tipoId" className="w-full border p-2 rounded" value={form.tipoId} onChange={onChange}>
<option value="">Selecione o tipo</option>
{tipos.map((t:any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
</select>


{/* Campos dinâmicos do tipo selecionado */}
{tipoSelecionado?.schemaJson?.campos?.length ? (
<div className="border rounded p-3">
<p className="font-medium mb-2">Campos específicos</p>
{tipoSelecionado.schemaJson.campos.map((c: any) => (
<div key={c.name} className="mb-2">
<label className="block text-sm mb-1">{c.label}</label>
<input className="w-full border p-2 rounded" onChange={e=>setExtras({ ...extras, [c.name]: e.target.value })} />
</div>
))}
</div>
) : null}


<button className="px-4 py-2 bg-black text-white rounded">Criar</button>
</form>
</div>
)
}