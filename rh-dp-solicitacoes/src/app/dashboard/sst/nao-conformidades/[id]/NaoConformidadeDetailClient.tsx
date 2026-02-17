'use client'

import Link from 'next/link'
import { DragEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import GutRadarCard from '@/components/sst/GutRadarCard'
import { GUT_OPTIONS } from '@/lib/sst/gut'

type Detail = any
type SectionKey = 'naoConformidade' | 'evidencias' | 'estudoCausa' | 'verificacao' | 'comentarios' | 'timeline'

export default function NaoConformidadeDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [analiseQualidade, setAnaliseQualidade] = useState('')
  const [causaRaiz, setCausaRaiz] = useState('')
  const [uploading, setUploading] = useState(false)
  const [gutSaving, setGutSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('naoConformidade')
  const [gut, setGut] = useState({ gravidade: 1, urgencia: 1, tendencia: 1 })
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
      setGut({
        gravidade: Number(data.item.gravidade) || 1,
        urgencia: Number(data.item.urgencia) || 1,
        tendencia: Number(data.item.tendencia) || 1,
      })
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
    setUploading(true)
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, { method: 'POST', body: form })
    setUploading(false)
    load()
  }

  async function removeAttachment(attachmentId: string) {
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [attachmentId] }),
    })
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
  async function salvarGut() {
    setGutSaving(true)
    await fetch(`/api/sst/nao-conformidades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gut),
    })
    setGutSaving(false)
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

  function changeSection(section: SectionKey) {
    setActiveSection(section)
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

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'naoConformidade', label: 'Não conformidade' },
            { key: 'evidencias', label: 'Evidências' },
            { key: 'estudoCausa', label: 'Estudo de causa (5 porquês)' },
            { key: 'verificacao', label: 'Verificação de eficácia' },
            { key: 'comentarios', label: 'Comentários' },
            { key: 'timeline', label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => changeSection(tab.key as SectionKey)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${activeSection === tab.key
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'naoConformidade' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
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

          <div className="space-y-4">
            <Card title="Matriz GUT">
              <FieldSelectNumeric label="Gravidade" value={gut.gravidade} options={GUT_OPTIONS.gravidade} onChange={(value) => setGut((prev) => ({ ...prev, gravidade: value }))} disabled={bloqueado} />
              <FieldSelectNumeric label="Urgência" value={gut.urgencia} options={GUT_OPTIONS.urgencia} onChange={(value) => setGut((prev) => ({ ...prev, urgencia: value }))} disabled={bloqueado} />
              <FieldSelectNumeric label="Tendência" value={gut.tendencia} options={GUT_OPTIONS.tendencia} onChange={(value) => setGut((prev) => ({ ...prev, tendencia: value }))} disabled={bloqueado} />
              <button disabled={bloqueado || gutSaving} onClick={salvarGut} className="w-full rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{gutSaving ? 'Salvando...' : 'Salvar GUT'}</button>
            </Card>
            <GutRadarCard gravidade={gut.gravidade} urgencia={gut.urgencia} tendencia={gut.tendencia} />
          </div>
        </section>
      ) : null}
      {activeSection === 'evidencias' ? (
        <Card title="Evidências">
          <div
            className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-center"
            onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              uploadFiles(e.dataTransfer.files)
            }}
          >
            <p className="text-sm text-slate-700">Arraste arquivos aqui</p>
            <label className="mt-2 inline-block cursor-pointer rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">
              Adicionar evidência
              <input type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
            </label>
            {uploading ? <p className="mt-2 text-xs text-slate-500">Enviando...</p> : null}
          </div>
          {item.anexos?.length ? (
            <ul className="space-y-2 text-sm">
              {item.anexos.map((a: any) => (
                <li key={a.id} className="rounded-md border border-slate-200 p-2">
                  {String(a.mimeType || '').startsWith('image/') ? (
                    <img src={a.url} alt={a.filename} className="mb-2 h-20 w-20 rounded object-cover" />
                  ) : null}
                  <a href={`/api/sst/nao-conformidades/${id}/anexos/${a.id}`} target="_blank" className="text-orange-700 hover:underline">{a.filename}</a>
                  <p className="text-xs text-slate-500">{Math.round((a.sizeBytes || 0) / 1024)} KB · {new Date(a.createdAt).toLocaleString('pt-BR')} · {a.createdBy?.fullName || 'Sistema'}</p>
                  <button onClick={() => removeAttachment(a.id)} className="mt-1 text-xs text-rose-600 hover:underline">Excluir</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Nenhum anexo.</p>}
        </Card>
      ) : null}

      {activeSection === 'estudoCausa' ? (
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
      ) : null}

      {activeSection === 'verificacao' ? (
        <Card title="Verificação de eficácia">
          <form onSubmit={salvarVerificacao} className="space-y-2">
            <textarea value={analiseQualidade} onChange={(e)=>setAnaliseQualidade(e.target.value)} disabled={bloqueado} className="w-full rounded border px-2 py-1 text-sm" rows={4} placeholder="Análise da qualidade" />
            <button disabled={bloqueado} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Salvar verificação</button>
          </form>
        </Card>
      ) : null}

      {activeSection === 'comentarios' ? (
        <Card title="Comentários">
          <form onSubmit={sendComment} className="mb-3 space-y-2">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Adicionar comentário" />
            <div className="text-right"><button className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Enviar comentário</button></div>
          </form>
        </Card>
      ) : null}

      {activeSection === 'timeline' ? (
        <Card title="Timeline">
          {item.timeline?.length ? <ul className="space-y-2">{item.timeline.map((t: any)=><li key={t.id} className="rounded-md border border-slate-200 p-2 text-sm"><p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR')} · {t.actor?.fullName || 'Sistema'}</p><p className="text-slate-700">{t.message || t.tipo}</p></li>)}</ul> : <p className="text-sm text-slate-500">Sem eventos.</p>}
        </Card>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"><h2 className="text-lg font-semibold text-slate-900">{title}</h2>{children}</section>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-wrap text-sm text-slate-800">{value}</p></div>
}

function FieldSelectNumeric({ label, value, options, onChange, disabled }: { label: string; value: number; options: ReadonlyArray<{ value: number; label: string }>; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
