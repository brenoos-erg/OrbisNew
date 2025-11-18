'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, RefreshCcw } from 'lucide-react'

type Row = {
    id: string
    titulo: string
    status: string
    protocolo?: string
    createdAt: string
    tipo?: { nome: string } | null
    autor?: { fullName: string } | null
    setorDestino?: string | null
}

export default function PainelAprovacaoPage() {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState<Row[]>([])
    const [userId, setUserId] = useState<string | null>(null)

    // 1) Carregar /api/me para descobrir quem é o usuário logado
    useEffect(() => {
        async function loadMe() {
            try {
                const res = await fetch('/api/me', { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                setUserId(data.id)
            } catch (e) {
                console.error('Erro ao carregar /api/me', e)
            }
        }
        loadMe()
    }, [])

    // 2) Buscar solicitações pendentes de aprovação para o usuário
    async function load() {
        if (!userId) return
        setLoading(true)
        try {
            const qs = new URLSearchParams()
            qs.set('page', '1')
            qs.set('pageSize', '50')
            qs.set('scope', 'to-approve')
            qs.set('userId', userId) // provisório – bate com o que usamos no GET da API

            const res = await fetch(`/api/solicitacoes?${qs.toString()}`, {
                cache: 'no-store',
            })
            const json = await res.json()
            setRows(json.rows ?? [])
        } catch (e) {
            console.error('Erro ao carregar solicitações para aprovação', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    async function aprovar(id: string) {
        if (!confirm('Confirma aprovar esta solicitação?')) return
        try {
            const res = await fetch(`/api/solicitacoes/${id}/aprovar`, {
                method: 'POST', // 👈 POST
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: '' }), // se quiser mandar comentário depois
            })

            if (!res.ok) {
                const err = await res.json().catch(() => null)
                alert(err?.error || 'Erro ao aprovar.')
                return
            }

            await load()
        } catch (e: any) {
            alert(e?.message || 'Erro ao aprovar.')
        }
    }


   async function reprovar(id: string) {
  const comment = prompt('Informe o motivo da reprovação:')
  if (!comment) {
    alert('Motivo é obrigatório.')
    return
  }

  if (!confirm('Confirma reprovar esta solicitação?')) return

  try {
    const res = await fetch(`/api/solicitacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      alert(err?.error || 'Erro ao reprovar.')
      return
    }

    await load() // recarrega a lista
  } catch (e: any) {
    alert(e?.message || 'Erro ao reprovar.')
  }
}



    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-800">
                        Painel de Aprovação
                    </h1>
                    <p className="text-sm text-slate-500">
                        Solicitações pendentes de aprovação para você.
                    </p>
                </div>

                <button
                    onClick={load}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                    <RefreshCcw size={16} />
                    Atualizar
                </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                            <th>Protocolo</th>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Título</th>
                            <th>Solicitante</th>
                            <th>Departamento</th>
                            <th className="text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                    Carregando...
                                </td>
                            </tr>
                        )}

                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                    Nenhuma solicitação pendente de aprovação.
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            rows.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">{r.protocolo ?? '-'}</td>
                                    <td className="px-3 py-2">
                                        {r.createdAt
                                            ? format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')
                                            : '-'}
                                    </td>
                                    <td className="px-3 py-2">{r.tipo?.nome ?? '-'}</td>
                                    <td className="px-3 py-2">{r.titulo}</td>
                                    <td className="px-3 py-2">{r.autor?.fullName ?? '-'}</td>
                                    <td className="px-3 py-2">{r.setorDestino ?? '-'}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => aprovar(r.id)}
                                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                                            >
                                                <CheckCircle2 size={14} />
                                                Aprovar
                                            </button>
                                            <button
  onClick={() => reprovar(r.id)}
  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
>
  <XCircle size={14} />
  Reprovar
</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
