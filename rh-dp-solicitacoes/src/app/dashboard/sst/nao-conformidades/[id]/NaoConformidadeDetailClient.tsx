'use client'

import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'

type Detail = any

export default function NaoConformidadeDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [analiseQualidade, setAnaliseQualidade] = useState('')
  const [causaRaiz, setCausaRaiz] = useState('')
  const [porques, setPorques] = useState<Array<{ pergunta: string; resposta: string }>>(
    Array.from({ length: 5 }).map((_, i) => ({ pergunta: `Por quê ${i + 1}?`, resposta: '' })),
  )

  const aprovado = item?.aprovadoQualidadeStatus === 'APROVADO'
  const bloqueado = !aprovado

   async function load() {
    try {
      setLoading(true)
      const res = await fetch(`/api/sst/nao-conformidades/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar')
      setItem(data.item)
      setAnaliseQualidade(data.item.verificacaoEficaciaTexto || '')
      setCausaRaiz(data.item.causaRaiz || '')
      if (Array.isArray(data.item.estudoCausa) && data.item.estudoCausa.length) {
        setPorques(data.item.estudoCausa.map((x: any) => ({ pergunta: x.pergunta, resposta: x.resposta || '' })))
      }
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
  async function aprovar(aprovadoValor: boolean) {
    await fetch(`/api/sst/nao-conformidades/${id}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprovado: aprovadoValor }),
    })
    load()
  }

  async function salvarEstudoCausa(e: FormEvent) {
    e.preventDefault()
    await fetch(`/api/sst/nao-conformidades/${id}/estudo-causa`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ causaRaiz, items: porques }),
    })
    load()
  }

  async function salvarVerificacao(e: FormEvent) {
    e.preventDefault()
    await fetch(`/api/sst/nao-conformidades/${id}/verificacao-eficacia`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analiseQualidade }),
    })
    load()
  }

  const podeAprovar = useMemo(() => item?.status === 'AGUARDANDO_APROVACAO_QUALIDADE', [item])

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

      {bloqueado ? <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">Aguardando aprovação da qualidade. Somente a aba de evidências está liberada.</div> : null}
      {podeAprovar ? <div className="flex gap-2"><button onClick={() => aprovar(true)} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Aprovar</button><button onClick={() => aprovar(false)} className="rounded bg-rose-600 px-3 py-2 text-sm text-white">Reprovar</button></div> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Não conformidade">
          <Info label="Descrição" value={item.descricao} />
          <Info label="Evidência objetiva" value={item.evidenciaObjetiva} />
          <Info label="Empresa" value={item.empresa} />
          <Info label="Centro que detectou" value={item.centroQueDetectou?.description || '-'} />
          <Info label="Centro que originou" value={item.centroQueOriginou?.description || '-'} />
          <Info label="Prazo atendimento" value={new Date(item.prazoAtendimento).toLocaleDateString('pt-BR')} />
          <Info label="Referência SIG" value={item.referenciaSig || '-'} />
          <Info label="Tipo NC" value={item.tipoNc} />
          <Info label="Ações imediatas" value={item.acoesImediatas || '-'} />
        </Card>
      <Card title="Evidências">
          <input type="file" multiple onChange={(e) => uploadFiles(e.target.files)} className="mb-3 text-sm" />
          {item.anexos?.length ? <ul className="space-y-1 text-sm">{item.anexos.map((a: any)=><li key={a.id}><a href={`/api/sst/nao-conformidades/${id}/anexos/${a.id}`} target="_blank" className="text-orange-700 hover:underline">{a.filename}</a></li>)}</ul> : <p className="text-sm text-slate-500">Nenhum anexo.</p>}
        </Card>
      </section>
       <Card title="Estudo de causa (5 porquês)">
        <form onSubmit={salvarEstudoCausa} className="space-y-2">
          {porques.map((p, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-2">
              <input value={p.pergunta} onChange={(e)=>setPorques((prev)=>prev.map((x,i)=>i===idx?{...x, pergunta:e.target.value}:x))} disabled={bloqueado} className="rounded border px-2 py-1 text-sm" />
              <input value={p.resposta} onChange={(e)=>setPorques((prev)=>prev.map((x,i)=>i===idx?{...x, resposta:e.target.value}:x))} disabled={bloqueado} placeholder="Resposta" className="rounded border px-2 py-1 text-sm" />
            </div>
          ))}
          <button type="button" disabled={bloqueado} onClick={()=>setPorques((p)=>[...p, { pergunta: `Por quê ${p.length + 1}?`, resposta: '' }])} className="rounded border px-2 py-1 text-sm">Adicionar porquê</button>
          <textarea value={causaRaiz} onChange={(e)=>setCausaRaiz(e.target.value)} disabled={bloqueado} className="w-full rounded border px-2 py-1 text-sm" placeholder="Causa raiz" />
          <button disabled={bloqueado} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Salvar estudo de causa</button>
        </form>
      </Card>

      <Card title="Verificação de eficácia">
        <form onSubmit={salvarVerificacao} className="space-y-2">
          <textarea value={analiseQualidade} onChange={(e)=>setAnaliseQualidade(e.target.value)} disabled={bloqueado} className="w-full rounded border px-2 py-1 text-sm" rows={4} placeholder="Análise da qualidade" />
          <button disabled={bloqueado} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Salvar verificação</button>
        </form>
      </Card>


      <Card title="Comentários">
        <form onSubmit={sendComment} className="mb-3 space-y-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Adicionar comentário" />
          <div className="text-right"><button className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Enviar comentário</button></div>
        </form>
       </Card>

      <Card title="Timeline">
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