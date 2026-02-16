'use client'

import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useState } from 'react'

type Detail = any

export default function NaoConformidadeDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')

  async function load() {
    try {
      setLoading(true)
      const res = await fetch(`/api/sst/nao-conformidades/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar')
      setItem(data.item)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function sendComment(e: FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    const res = await fetch(`/api/sst/nao-conformidades/${id}/comentarios`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: comment }),
    })
    if (res.ok) {
      setComment('')
      load()
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    const form = new FormData()
    Array.from(files).forEach((f) => form.append('files', f))
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, { method: 'POST', body: form })
    load()
  }

  if (loading && !item) return <p className="text-sm text-slate-600">Carregando...</p>
  if (error && !item) return <p className="text-sm text-rose-700">{error}</p>
  if (!item) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm uppercase text-slate-500">Segurança do Trabalho</p>
          <h1 className="text-2xl font-bold text-slate-900">{item.numeroRnc}</h1>
        </div>
        <Link href="/dashboard/sst/nao-conformidades" className="ml-auto text-sm font-medium text-orange-600 hover:text-orange-700">Voltar</Link>
      </div>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Dados principais">
          <Info label="Status" value={item.status} />
          <Info label="Tipo" value={item.tipo} />
          <Info label="Classificação" value={item.classificacao} />
          <Info label="Origem" value={item.origem} />
          <Info label="Local" value={item.local} />
          <Info label="Data" value={new Date(item.dataOcorrencia).toLocaleDateString('pt-BR')} />
          <Info label="Solicitante" value={`${item.solicitanteNome} (${item.solicitanteEmail})`} />
          <Info label="Responsável" value={item.responsavelTratativa?.fullName ?? '-'} />
        </Card>
        <Card title="Descrição / Causa raiz / Ação imediata">
          <Info label="Descrição" value={item.descricao} />
          <Info label="Ação imediata" value={item.acaoImediata || '-'} />
          <Info label="Causa raiz" value={item.causaRaiz || '-'} />
        </Card>
      </section>

      <Card title="Plano de ação">
        {item.planoDeAcao?.length ? (
          <div className="overflow-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="px-2 py-1">O quê</th><th className="px-2 py-1">Responsável</th><th className="px-2 py-1">Prazo</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Evidências</th></tr></thead><tbody>{item.planoDeAcao.map((a: any)=><tr key={a.id} className="border-t"><td className="px-2 py-1">{a.descricao}</td><td className="px-2 py-1">{a.responsavel?.fullName || a.responsavelNome || '-'}</td><td className="px-2 py-1">{a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '-'}</td><td className="px-2 py-1">{a.status}</td><td className="px-2 py-1">{a.evidencias || '-'}</td></tr>)}</tbody></table></div>
        ) : <p className="text-sm text-slate-500">Sem ações cadastradas.</p>}
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Evidências / Anexos">
          <input type="file" multiple onChange={(e) => uploadFiles(e.target.files)} className="mb-3 text-sm" />
          {item.anexos?.length ? <ul className="space-y-1 text-sm">{item.anexos.map((a: any)=><li key={a.id}><a href={a.url} target="_blank" className="text-orange-700 hover:underline">{a.filename}</a></li>)}</ul> : <p className="text-sm text-slate-500">Nenhum anexo.</p>}
        </Card>
        <Card title="Verificação de eficácia">
          <Info label="Análise" value={item.verificacaoEficaciaTexto || '-'} />
          <Info label="Data" value={item.verificacaoEficaciaData ? new Date(item.verificacaoEficaciaData).toLocaleDateString('pt-BR') : '-'} />
          <Info label="Aprovado por" value={item.verificacaoEficaciaAprovadoPor?.fullName || '-'} />
        </Card>
      </section>

      <Card title="Comentários">
        <form onSubmit={sendComment} className="mb-3 space-y-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Adicionar comentário" />
          <div className="text-right"><button className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Enviar comentário</button></div>
        </form>
        {item.comentarios?.length ? <ul className="space-y-2">{item.comentarios.map((c: any)=><li key={c.id} className="rounded-md border border-slate-200 p-2"><p className="text-xs text-slate-500">{c.autor?.fullName} · {new Date(c.createdAt).toLocaleString('pt-BR')}</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{c.texto}</p></li>)}</ul> : <p className="text-sm text-slate-500">Sem comentários.</p>}
      </Card>

      <Card title="Linha do tempo">
        {item.timeline?.length ? <ul className="space-y-2">{item.timeline.map((t: any)=><li key={t.id} className="rounded-md border border-slate-200 p-2 text-sm"><p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR')} · {t.actor?.fullName || 'Sistema'}</p><p className="text-slate-700">{t.message || t.tipo}</p></li>)}</ul> : <p className="text-sm text-slate-500">Sem eventos.</p>}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"><h2 className="text-lg font-semibold text-slate-900">{title}</h2>{children}</section>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-wrap text-sm text-slate-800">{value}</p></div>
}