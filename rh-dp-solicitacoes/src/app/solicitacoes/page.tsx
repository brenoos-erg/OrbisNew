// Lista as solicitações existentes
async function getData() {
const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/solicitacoes` : `${process.env.NEXT_PUBLIC_VERCEL_URL ? 'https://'+process.env.NEXT_PUBLIC_VERCEL_URL : ''}/api/solicitacoes`, { cache: 'no-store' })
// Acima fazemos uma URL relativa/absoluta compatível com Vercel; em dev, pode usar '/api/solicitacoes'
if (!res.ok) return []
return res.json()
}


export default async function ListaSolicitacoesPage() {
const data = await getData()
return (
<div className="space-y-4">
<h1 className="text-xl font-semibold">Solicitações</h1>
<a href="/solicitacoes/nova" className="inline-block px-3 py-2 bg-black text-white rounded">Nova</a>
<div className="grid gap-3">
{data.map((s:any) => (
<a key={s.id} href={`/solicitacoes/${s.id}`} className="block border rounded p-3 bg-white">
<div className="font-medium">{s.titulo}</div>
<div className="text-sm text-gray-600">{s.tipo?.nome} • {s.status} • {new Date(s.createdAt).toLocaleString('pt-BR')}</div>
</a>
))}
{!data?.length && <p className="text-gray-600">Nenhuma solicitação ainda.</p>}
</div>
</div>
)
}